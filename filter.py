FILTER_POOL = [
    {"id": "sobel", "name": "Sobel", "matrix": 
     [[1,0,-1],
      [-1,0,1],
      [1,0,-1]]},
    {"id": "laplacian", "name": "Laplacian", "matrix": 
     [[-1,1,0],
      [1,0,1],
      [0,1,-1]]},
    {"id": "edge", "name": "Edge Enhance", "matrix": 
     [[-1,-1,-1],
      [-1,3,-1],
      [-1,-1,-1]]},
    {"id": "invert_center", "name": "Inversion Pulse", "matrix": 
     [[0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0]]},
    {"id": "diag_split", "name": "Diagonal Splitter", "matrix": 
     [[-1, 0, 1],
      [0, 0, 0],
      [1, 0, -1]]},
    {"id": "stealth", "name": "Stealth Disruptor", "matrix":
     [[0, -0.5, 0],
      [-0.5, 3, -0.5],
      [0, -0.5, 0]]}
    # ... 更多卷積卡
]