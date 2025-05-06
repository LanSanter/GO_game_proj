import uuid

class Game:
    def __init__(self):
        self.board = [[None for _ in range(19)] for _ in range(19)]
        self.turn = "black"
        self.moves = []

    def place_stone(self, x, y, color):
        if not self.is_valid_move(x, y, color):
            return {"x": x, "y": y, "color": color, "success": False, "message": "Invalid move."}

        self.board[y][x] = color
        opponent = "white" if color == "black" else "black"
        to_capture = []

        # 檢查落子是否造成提子
        for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < 19 and 0 <= ny < 19 and self.board[ny][nx] == opponent:
                group, has_liberty = self.get_group_and_liberties(nx, ny)
                if not has_liberty:
                    to_capture.extend(group)

        if to_capture:
            self.remove_group(to_capture)

        # 檢查自己是否變成無氣（自殺）
        group, has_liberty = self.get_group_and_liberties(x, y)
        if not has_liberty:
            self.board[y][x] = None
            return {"x": x, "y": y, "color": color, "success": False, "message": "Suicide move."}
        
        # 落子正常，紀錄
        self.moves.append({"x": x, "y": y, "color": color}) 
        self.turn = opponent
        return {
            "x": x, "y": y, "color": color,
            "success": True,
            "captures": to_capture  # 傳給前端清除
        }


    def is_valid_move(self, x, y, color):
        if 0 <= x < 19 and 0 <= y < 19:
            if self.board[y][x] is None and color == self.turn:
                return True
        return False
    
    # 尋找連通區域並判斷有無'氣'
    def get_group_and_liberties(self, x, y):
        color = self.board[y][x]
        if color is None:
            return [], True

        visited = set()
        group = []
        has_liberty = False
        stack = [(x, y)]

        # dfs搜尋連通區塊
        while stack:
            cx, cy = stack.pop()
            if (cx, cy) in visited:
                continue
            visited.add((cx, cy))
            group.append((cx, cy))

            for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < 19 and 0 <= ny < 19:
                    neighbor = self.board[ny][nx]
                    if neighbor is None:
                        has_liberty = True
                    elif neighbor == color and (nx, ny) not in visited:
                        stack.append((nx, ny))

        return group, has_liberty

    # 清除指定區域棋子
    def remove_group(self, group):
        for x, y in group:
            self.board[y][x] = None


    def reset_board(self):
        moves = self.moves.copy()
        self.__init__()
        return {"success": True, "message": "Board reset.", "moves": moves}

class GameManager:
    def __init__(self):
        self.games = {}

    def create_game(self):
        game_id = str(uuid.uuid4())
        self.games[game_id] = Game()
        return game_id

    def place_stone(self, game_id, x, y, color):
        game = self.games.get(game_id)
        if game:
            return game.place_stone(x, y, color)
        return {"success": False, "message": "Game not found."}

    def reset_game(self, game_id):
        game = self.games.get(game_id)
        if game:
            return game.reset_board()
        return {"success": False, "message": "Game not found."}
