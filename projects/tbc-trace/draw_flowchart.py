"""
用 Pillow 生成 TBC 溯源流程图
"""

from PIL import Image, ImageDraw, ImageFont
import sys
sys.path.insert(0, '/Users/jay/.openclaw/workspace/projects/tbc-trace')

# 交易数据（从之前的溯源结果）
path1_nodes = [
    ("3d1c8b40eba1e84f", "FT_Mint", 0.0005),
    ("1567ac0a1bac93ca", "FT_Mint", 0.0005),
    ("918c158aaf2cd022", "FT_Mint", 0.0005),
    ("3fa9b899d740743a", "FT_Mint", 4.7759),
    ("e2433c0a55dfc44e", "FT_Mint", 7.9821),
    ("09f4508aa3d7233c", "FT_Mint", 6.9851),
    ("61b6312d50b2fd4a", "FT_Mint", 5.9881),
    ("ae0c393a6bd31e74", "FT_Mint", 4.9911),
    ("2d84e1ae61d21aeb", "FT_Mint", 5.0791),
    ("5569efdd4a9cee21", "FT_Mint", 10.1452),
    ("2e987d04d6861502", "FT_Mint", 10.9269),
    ("04fb83e4a6a4fe45", "FT_Mint", 11.2318),
    ("66d6eafb9291ea15", "FT_Mint", 11.1328),
    ("b91ad4f5862b5f05", "FT_Mint", 11.0331),
    ("5fd1a949b4bbe0b4", "FT_Mint", 11.0301),
    ("0bdf5b3171832630", "FT_Mint", 10.9311),
    ("d27f60d206a5b1ff", "FT_Mint", 10.7321),
    ("c2f5da25c6b21217", "FT_Mint", 10.7341),
    ("ba7398123cf1eab2", "FT_Mint", 10.6351),
    ("21d02a0801a665fc", "FT_Mint", 10.1361),
    ("0de58bab8d0cb29b", "FT_Mint", 9.8370),
    ("24e6ac80013a422e", "FT_Mint", 8.8400),
    ("ec8493ee24fac126", "FT_Mint", 8.8210),
    ("4ffe6545c498e788", "FT_Mint", 8.7220),
    ("38502f521b64626c", "FT_Mint", 8.3232),
    ("64f985a3371d2dc3", "FT_Mint", 8.2235),
    ("df776b162406b0bb", "FT_Mint", 7.7245),
    ("d4a198b3e83ef326", "FT_Mint", 7.5495),
    ("d8935b74f62bcbe2", "FT_Mint", 7.5005),
    ("540e9900f8a90c25", "FT_Mint", 7.4515),
]

path2_nodes = [
    ("dccacf93080c569b", "FT_Mint", 12.1854),
    ("69e0548f92e0f1f7", "FT_Mint", 5.2464),
    ("0235b682a8fb91da", "FT_Mint", 5.0575),
]

target = ("c340f810b98039ddd37fef357f947f37c3735733cf23c858727ec10a3008e0a9", "FT_Mint (TARGET)", 12.1854)

# 颜色配置
COLORS = {
    "FT_Mint": "#90EE90",
    "FT_Transfer": "#98FB98",
    "P2PKH": "#87CEEB",
    "Coinbase": "#FFD700",
    "TARGET": "#FF6B6B",
}

def draw_flowchart():
    # 图片尺寸
    width = 1400
    height = 2000
    
    # 创建图片
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    # 尝试加载字体
    try:
        font_title = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
        font_node = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
    except:
        font_title = ImageFont.load_default()
        font_node = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # 标题
    draw.text((width//2 - 300, 20), "TBC Transaction Trace Flowchart", fill='black', font=font_title)
    draw.text((50, 60), f"Target: {target[0][:40]}...", fill='black', font=font_small)
    draw.text((50, 80), f"Type: {target[1]}", fill='black', font=font_small)
    
    # 节点尺寸
    node_width = 280
    node_height = 60
    start_y = 150
    spacing_y = 50
    
    # 画路径1（左侧）
    x1 = 200
    y = start_y
    
    draw.text((x1, y - 40), "Path 1 (TBC)", fill='blue', font=font_node)
    
    # 画节点（从下往上画，从 Coinbase 到目标）
    for i, (txid, tx_type, value) in enumerate(reversed(path1_nodes)):
        color = COLORS.get(tx_type, "#CCCCCC")
        
        # 画圆角矩形
        draw.rounded_rectangle(
            [x1, y, x1 + node_width, y + node_height],
            radius=10,
            fill=color,
            outline='black',
            width=2
        )
        
        # 画文字
        draw.text((x1 + 10, y + 8), f"{tx_type}", fill='black', font=font_node)
        draw.text((x1 + 10, y + 28), f"{txid}...", fill='#333333', font=font_small)
        draw.text((x1 + 10, y + 44), f"Value: {value:.4f} TBC", fill='#555555', font=font_small)
        
        # 画箭头（如果不是最后一个）
        if i < len(path1_nodes) - 1:
            draw.polygon(
                [(x1 + node_width//2 - 5, y + node_height), 
                 (x1 + node_width//2 + 5, y + node_height),
                 (x1 + node_width//2, y + node_height + 15)],
                fill='black'
            )
            draw.line(
                [(x1 + node_width//2, y + node_height), 
                 (x1 + node_width//2, y + node_height + spacing_y - 5)],
                fill='black',
                width=2
            )
        
        y += node_height + spacing_y
    
    # 画路径2（右侧）
    x2 = 800
    y = start_y
    
    draw.text((x2, y - 40), "Path 2 (TBC)", fill='blue', font=font_node)
    
    for i, (txid, tx_type, value) in enumerate(reversed(path2_nodes)):
        color = COLORS.get(tx_type, "#CCCCCC")
        
        draw.rounded_rectangle(
            [x2, y, x2 + node_width, y + node_height],
            radius=10,
            fill=color,
            outline='black',
            width=2
        )
        
        draw.text((x2 + 10, y + 8), f"{tx_type}", fill='black', font=font_node)
        draw.text((x2 + 10, y + 28), f"{txid}...", fill='#333333', font=font_small)
        draw.text((x2 + 10, y + 44), f"Value: {value:.4f} TBC", fill='#555555', font=font_small)
        
        if i < len(path2_nodes) - 1:
            draw.polygon(
                [(x2 + node_width//2 - 5, y + node_height), 
                 (x2 + node_width//2 + 5, y + node_height),
                 (x2 + node_width//2, y + node_height + 15)],
                fill='black'
            )
            draw.line(
                [(x2 + node_width//2, y + node_height), 
                 (x2 + node_width//2, y + node_height + spacing_y - 5)],
                fill='black',
                width=2
            )
        
        y += node_height + spacing_y
    
    # 画目标节点（底部中央）
    target_y = max(start_y + len(path1_nodes) * (node_height + spacing_y), 
                   start_y + len(path2_nodes) * (node_height + spacing_y)) + 50
    
    target_x = (width - node_width) // 2
    
    # 画从路径1到目标的箭头
    path1_end_y = start_y + len(path1_nodes) * (node_height + spacing_y) - spacing_y + node_height
    path2_end_y = start_y + len(path2_nodes) * (node_height + spacing_y) - spacing_y + node_height
    
    # 路径1到目标的连接线
    draw.line(
        [(x1 + node_width//2, path1_end_y),
         (x1 + node_width//2, target_y - 30),
         (target_x + node_width//2 - 50, target_y - 30)],
        fill='red',
        width=3
    )
    draw.polygon(
        [(target_x + node_width//2 - 55, target_y - 35),
         (target_x + node_width//2 - 45, target_y - 35),
         (target_x + node_width//2 - 50, target_y - 25)],
        fill='red'
    )
    
    # 路径2到目标的连接线
    draw.line(
        [(x2 + node_width//2, path2_end_y),
         (x2 + node_width//2, target_y - 30),
         (target_x + node_width//2 + 50, target_y - 30)],
        fill='red',
        width=3
    )
    draw.polygon(
        [(target_x + node_width//2 + 45, target_y - 35),
         (target_x + node_width//2 + 55, target_y - 35),
         (target_x + node_width//2 + 50, target_y - 25)],
        fill='red'
    )
    
    # 画目标节点
    draw.rounded_rectangle(
        [target_x, target_y, target_x + node_width, target_y + node_height + 20],
        radius=10,
        fill=COLORS["TARGET"],
        outline='darkred',
        width=4
    )
    
    draw.text((target_x + 10, target_y + 10), "*** TARGET ***", fill='white', font=font_node)
    draw.text((target_x + 10, target_y + 32), f"{target[1]}", fill='white', font=font_small)
    draw.text((target_x + 10, target_y + 50), f"{target[0][:35]}...", fill='#FFE4E1', font=font_small)
    
    # 添加图例
    legend_x = 50
    legend_y = height - 200
    
    draw.text((legend_x, legend_y), "Legend:", fill='black', font=font_node)
    
    legend_items = [
        ("FT_Mint", COLORS["FT_Mint"]),
        ("FT_Transfer", COLORS["FT_Transfer"]),
        ("P2PKH", COLORS["P2PKH"]),
        ("Coinbase", COLORS["Coinbase"]),
        ("TARGET", COLORS["TARGET"]),
    ]
    
    for i, (name, color) in enumerate(legend_items):
        y_offset = legend_y + 30 + i * 25
        draw.rectangle([legend_x, y_offset, legend_x + 20, y_offset + 20], fill=color, outline='black')
        draw.text((legend_x + 30, y_offset), name, fill='black', font=font_small)
    
    # 添加统计信息
    stats_x = width - 300
    draw.text((stats_x, legend_y), "Statistics:", fill='black', font=font_node)
    draw.text((stats_x, legend_y + 30), f"Path 1 Depth: {len(path1_nodes)}", fill='black', font=font_small)
    draw.text((stats_x, legend_y + 50), f"Path 2 Depth: {len(path2_nodes)}", fill='black', font=font_small)
    draw.text((stats_x, legend_y + 70), f"Convergence: Depth 3", fill='black', font=font_small)
    draw.text((stats_x, legend_y + 90), f"Transaction Type: FT_Mint", fill='black', font=font_small)
    
    # 保存图片
    output_path = "/tmp/tbc_trace_flowchart.png"
    img.save(output_path, "PNG")
    print(f"Flowchart saved to: {output_path}")
    
    return output_path

if __name__ == "__main__":
    draw_flowchart()
