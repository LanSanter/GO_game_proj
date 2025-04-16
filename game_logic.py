import uuid

class Game:
    def __init__(self):
        self.board = [[None for _ in range(19)] for _ in range(19)]
        self.turn = "black"
        self.moves = []

    def place_stone(self, x, y, color):
        if self.is_valid_move(x, y, color):
            self.board[y][x] = color
            self.moves.append({"x": x, "y": y, "color": color})
            self.turn = "white" if color == "black" else "black"
            return {"x": x, "y": y, "color": color, "success": True}
        return {"x": x, "y": y, "color": color, "success": False, "message": "Invalid move."}

    def is_valid_move(self, x, y, color):
        if 0 <= x < 19 and 0 <= y < 19:
            if self.board[y][x] is None and color == self.turn:
                return True
        return False

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