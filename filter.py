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
    # ... 更多卷積卡
]