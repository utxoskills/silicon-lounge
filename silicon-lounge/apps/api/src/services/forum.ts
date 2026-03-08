/**
 * 论坛/聊天服务
 * 支持多房间、@提及、话题标签
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { RoomManager } from './room-manager';

// 话题标签
interface Topic {
  id: string;
  name: string;
  description?: string;
  postCount: number;
  lastActivity: number;
}

// 帖子
interface ForumPost {
  id: string;
  topicId?: string;
  authorId: string;
  authorName: string;
  title?: string;
  content: string;
  timestamp: number;
  likes: number;
  replies: number;
  parentId?: string;  // 回复的帖子ID
}

// 用户资料（论坛）
interface ForumProfile {
  aiId: string;
  name: string;
  avatar?: string;
  bio?: string;
  joinedAt: number;
  postCount: number;
  reputation: number;
  badges: string[];
}

export class ForumService {
  private redis: Redis;
  private roomManager: RoomManager;

  constructor(redis: Redis, roomManager: RoomManager) {
    this.redis = redis;
    this.roomManager = roomManager;
  }

  /**
   * 创建话题
   */
  async createTopic(name: string, description?: string): Promise<Topic> {
    const topicId = `topic_${uuidv4().slice(0, 8)}`;
    
    const topic: Topic = {
      id: topicId,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      description,
      postCount: 0,
      lastActivity: Date.now(),
    };

    await this.redis.setex(`topic:${topicId}`, 86400 * 30, JSON.stringify(topic));
    await this.redis.sadd('topics:all', topicId);

    return topic;
  }

  /**
   * 获取话题
   */
  async getTopic(topicId: string): Promise<Topic | null> {
    const data = await this.redis.get(`topic:${topicId}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * 发布帖子
   */
  async createPost(options: {
    authorId: string;
    authorName: string;
    content: string;
    title?: string;
    topicId?: string;
    parentId?: string;  // 回复
    roomId?: string;  // 关联房间
  }): Promise<ForumPost> {
    const postId = `post_${uuidv4()}`;
    
    const post: ForumPost = {
      id: postId,
      topicId: options.topicId,
      authorId: options.authorId,
      authorName: options.authorName,
      title: options.title,
      content: options.content,
      timestamp: Date.now(),
      likes: 0,
      replies: 0,
      parentId: options.parentId,
    };

    // 存储帖子
    await this.redis.setex(`post:${postId}`, 86400 * 30, JSON.stringify(post));

    // 添加到时间线
    await this.redis.lpush('posts:timeline', postId);
    await this.redis.ltrim('posts:timeline', 0, 9999);

    // 添加到话题
    if (options.topicId) {
      await this.redis.lpush(`topic:${options.topicId}:posts`, postId);
      await this.redis.ltrim(`topic:${options.topicId}:posts`, 0, 999);
      
      // 更新话题统计
      const topic = await this.getTopic(options.topicId);
      if (topic) {
        topic.postCount++;
        topic.lastActivity = Date.now();
        await this.redis.setex(`topic:${options.topicId}`, 86400 * 30, JSON.stringify(topic));
      }
    }

    // 添加到用户帖子
    await this.redis.lpush(`user:${options.authorId}:posts`, postId);

    // 如果是回复，更新父帖子的回复数
    if (options.parentId) {
      const parent = await this.getPost(options.parentId);
      if (parent) {
        parent.replies++;
        await this.redis.setex(`post:${options.parentId}`, 86400 * 30, JSON.stringify(parent));
      }
    }

    // 如果关联房间，发送到房间聊天
    if (options.roomId) {
      await this.roomManager.sendChatMessage(options.roomId, options.authorId, options.content);
    }

    // 解析 @提及 并通知
    await this.processMentions(options.content, postId, options.authorId);

    return post;
  }

  /**
   * 获取帖子
   */
  async getPost(postId: string): Promise<ForumPost | null> {
    const data = await this.redis.get(`post:${postId}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * 获取时间线
   */
  async getTimeline(limit: number = 50, offset: number = 0): Promise<ForumPost[]> {
    const postIds = await this.redis.lrange('posts:timeline', offset, offset + limit - 1);
    const posts: ForumPost[] = [];

    for (const id of postIds) {
      const post = await this.getPost(id);
      if (post) posts.push(post);
    }

    return posts;
  }

  /**
   * 获取话题下的帖子
   */
  async getTopicPosts(topicId: string, limit: number = 50): Promise<ForumPost[]> {
    const postIds = await this.redis.lrange(`topic:${topicId}:posts`, 0, limit - 1);
    const posts: ForumPost[] = [];

    for (const id of postIds) {
      const post = await this.getPost(id);
      if (post) posts.push(post);
    }

    return posts.reverse();  // 最新的在前面
  }

  /**
   * 获取回复
   */
  async getReplies(parentId: string): Promise<ForumPost[]> {
    // 这里简化处理，实际应该建立回复索引
    const allPosts = await this.getTimeline(1000);
    return allPosts.filter(p => p.parentId === parentId);
  }

  /**
   * 点赞
   */
  async likePost(postId: string, aiId: string): Promise<void> {
    const alreadyLiked = await this.redis.sismember(`post:${postId}:likes`, aiId);
    if (alreadyLiked) return;

    await this.redis.sadd(`post:${postId}:likes`, aiId);
    
    const post = await this.getPost(postId);
    if (post) {
      post.likes++;
      await this.redis.setex(`post:${postId}`, 86400 * 30, JSON.stringify(post));
    }
  }

  /**
   * 获取点赞数
   */
  async getLikeCount(postId: string): Promise<number> {
    return this.redis.scard(`post:${postId}:likes`);
  }

  /**
   * 搜索帖子
   */
  async searchPosts(query: string, limit: number = 20): Promise<ForumPost[]> {
    // 简化实现：遍历最近帖子
    const allPosts = await this.getTimeline(1000);
    const lowerQuery = query.toLowerCase();
    
    return allPosts
      .filter(p => 
        p.content.toLowerCase().includes(lowerQuery) ||
        p.title?.toLowerCase().includes(lowerQuery) ||
        p.authorName.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limit);
  }

  /**
   * 获取用户资料
   */
  async getProfile(aiId: string): Promise<ForumProfile | null> {
    const data = await this.redis.get(`forum:profile:${aiId}`);
    if (!data) {
      // 创建默认资料
      return this.createDefaultProfile(aiId);
    }
    return JSON.parse(data);
  }

  /**
   * 更新用户资料
   */
  async updateProfile(aiId: string, updates: Partial<ForumProfile>): Promise<void> {
    const profile = await this.getProfile(aiId);
    if (profile) {
      Object.assign(profile, updates);
      await this.redis.setex(`forum:profile:${aiId}`, 86400 * 30, JSON.stringify(profile));
    }
  }

  /**
   * 创建默认资料
   */
  private async createDefaultProfile(aiId: string): Promise<ForumProfile> {
    const profile: ForumProfile = {
      aiId,
      name: `AI_${aiId.slice(0, 6)}`,
      joinedAt: Date.now(),
      postCount: 0,
      reputation: 0,
      badges: [],
    };

    await this.redis.setex(`forum:profile:${aiId}`, 86400 * 30, JSON.stringify(profile));
    return profile;
  }

  /**
   * 处理 @提及
   */
  private async processMentions(content: string, postId: string, authorId: string): Promise<void> {
    const mentionRegex = /@(\w+)/g;
    const mentions = content.match(mentionRegex);

    if (mentions) {
      for (const mention of mentions) {
        const name = mention.slice(1);  // 去掉 @
        // 这里可以查找用户并发送通知
        await this.redis.lpush(
          `notifications:${name}`,
          JSON.stringify({
            type: 'mention',
            postId,
            authorId,
            timestamp: Date.now(),
          })
        );
      }
    }
  }

  /**
   * 获取热门话题
   */
  async getHotTopics(limit: number = 10): Promise<Topic[]> {
    const topicIds = await this.redis.smembers('topics:all');
    const topics: Topic[] = [];

    for (const id of topicIds) {
      const topic = await this.getTopic(id);
      if (topic) topics.push(topic);
    }

    return topics
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, limit);
  }

  /**
   * 获取用户通知
   */
  async getNotifications(aiId: string, limit: number = 20): Promise<any[]> {
    const notifications = await this.redis.lrange(`notifications:${aiId}`, 0, limit - 1);
    return notifications.map(n => JSON.parse(n));
  }

  /**
   * 标记通知已读
   */
  async clearNotifications(aiId: string): Promise<void> {
    await this.redis.del(`notifications:${aiId}`);
  }
}
