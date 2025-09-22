from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import os
import sys

app = Flask(__name__)
CORS(app)  # Enable CORS

# -----------------------------
# Model Path
# -----------------------------
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'pipe_joblib.pkl')  # <-- updated to joblib
print(f"Current working directory: {os.getcwd()}")
print(f"Model path: {MODEL_PATH}")
print(f"Model exists: {os.path.exists(MODEL_PATH)}")

# -----------------------------
# Load the model using joblib
# -----------------------------
try:
    lr_model = joblib.load(MODEL_PATH)
    print("Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {e}")
    sys.exit(1)  # Exit if model cannot be loaded

# -----------------------------
# Routes
# -----------------------------
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "Welcome to the Cricket Prediction API. Use POST /predict to get predictions."
    }), 200

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        print("Received data:", data)

        if not data:
            return jsonify({'error': 'No JSON data received'}), 400

        # Extract input values
        batting_team = data.get('batting_team')
        bowling_team = data.get('bowling_team')
        city = data.get('city')
        runs_left = data.get('runs_left')
        balls_left = data.get('balls_left')
        wickets_remaining = data.get('wickets_remaining')
        total_run_x = data.get('total_run_x')

        # Validate input
        if any(v is None for v in [batting_team, bowling_team, city, runs_left, balls_left, wickets_remaining, total_run_x]):
            return jsonify({'error': 'Missing required fields in input data'}), 400

        # Handle special cases
        if wickets_remaining == 0:
            return jsonify({
                "batting_team": {"team_name": batting_team, "winning_probability": 0.00},
                "bowling_team": {"team_name": bowling_team, "winning_probability": 100.00}
            })
        if runs_left > 1 and balls_left == 0:
            return jsonify({
                "batting_team": {"team_name": batting_team, "winning_probability": 0.00},
                "bowling_team": {"team_name": bowling_team, "winning_probability": 100.00}
            })
        if balls_left == 0 and runs_left == 1:
            return jsonify({
                "batting_team": {"team_name": batting_team, "winning_probability": 50.00},
                "bowling_team": {"team_name": bowling_team, "winning_probability": 50.00}
            })
        if runs_left == 0 and balls_left > 0:
            return jsonify({
                "batting_team": {"team_name": batting_team, "winning_probability": 100.00},
                "bowling_team": {"team_name": bowling_team, "winning_probability": 0.00}
            })

        # Compute CRR and RRR
        crr = (total_run_x - runs_left) / ((120 - balls_left) / 6) if balls_left < 120 else 0
        rrr = (runs_left * 6) / balls_left if balls_left > 0 else 0

        # Prepare dataframe for model
        input_data = pd.DataFrame({
            'batting_team': [batting_team],
            'bowling_team': [bowling_team],
            'city': [city],
            'runs_left': [runs_left],
            'balls_left': [balls_left],
            'wickets_remaining': [wickets_remaining],
            'total_run_x': [total_run_x],
            'crr': [crr],
            'rrr': [rrr]
        })

        print("Input data for model prediction:")
        print(input_data)

        # Make prediction
        lr_prediction = lr_model.predict_proba(input_data)[0]
        print("Prediction (LR):", lr_prediction)

        # Construct response
        response = {
            "batting_team": {
                "team_name": batting_team,
                "winning_probability": round(lr_prediction[1] * 100, 2)
            },
            "bowling_team": {
                "team_name": bowling_team,
                "winning_probability": round(lr_prediction[0] * 100, 2)
            }
        }
        print("Response being sent:", response)

        return jsonify(response)

    except Exception as e:
        print(f"Error during prediction: {e}")
        return jsonify({'error': str(e)}), 500

# -----------------------------
# Run app
# -----------------------------
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
