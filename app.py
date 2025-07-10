from flask import Flask, jsonify, request
import cv2
import numpy as np
import mediapipe as mp
import tempfile
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

mp_pose = mp.solutions.pose

def calculate_angle(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians*180.0/np.pi)
    if angle > 180.0:
        angle = 360 - angle
    return angle

@app.route('/')
def home():
    return jsonify({'message': 'Posture Detection Backend is running.'})

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400
    file = request.files['image']
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp:
        file.save(temp.name)
        image = cv2.imread(temp.name)
    if image is None:
        return jsonify({'error': 'Invalid image'}), 400
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    with mp_pose.Pose(static_image_mode=True) as pose:
        results = pose.process(image_rgb)
        if not results.pose_landmarks:
            return jsonify({'error': 'No person detected'}), 200
        landmarks = results.pose_landmarks.landmark
        # Get coordinates for right side (can be adapted for left)
        shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
        hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
        knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y]
        ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]
        # Calculate angles
        knee_angle = calculate_angle(hip, knee, ankle)
        back_angle = calculate_angle(shoulder, hip, knee)
        # Rule-based logic
        feedback = []
        if knee[0] > ankle[0]:
            feedback.append('Knee goes beyond toe (bad squat posture)')
        if back_angle < 150:
            feedback.append('Back angle < 150° (bad squat posture)')
        if not feedback:
            feedback.append('Good squat posture detected')
        return jsonify({'knee_angle': round(knee_angle,2), 'back_angle': round(back_angle,2), 'feedback': feedback})

@app.route('/analyze_video', methods=['POST'])
def analyze_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video uploaded'}), 400
    file = request.files['video']
    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp:
        file.save(temp.name)
        video_path = temp.name
    cap = cv2.VideoCapture(video_path)
    frame_count = 0
    bad_posture_frames = 0
    total_frames = 0
    feedback_frames = []
    with mp_pose.Pose(static_image_mode=False) as pose:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            total_frames += 1
            if total_frames % 10 != 0:
                continue  # Process every 10th frame
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image_rgb)
            if not results.pose_landmarks:
                continue
            landmarks = results.pose_landmarks.landmark
            shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
            hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
            knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y]
            ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]
            knee_angle = calculate_angle(hip, knee, ankle)
            back_angle = calculate_angle(shoulder, hip, knee)
            frame_feedback = []
            if knee[0] > ankle[0]:
                frame_feedback.append('Knee goes beyond toe')
            if back_angle < 150:
                frame_feedback.append('Back angle < 150°')
            if frame_feedback:
                bad_posture_frames += 1
            feedback_frames.append({
                'frame': total_frames,
                'knee_angle': round(knee_angle,2),
                'back_angle': round(back_angle,2),
                'feedback': frame_feedback or ['Good posture']
            })
    cap.release()
    summary = {
        'total_frames': total_frames,
        'analyzed_frames': len(feedback_frames),
        'bad_posture_frames': bad_posture_frames,
        'bad_posture_percentage': round((bad_posture_frames/len(feedback_frames))*100, 2) if feedback_frames else 0
    }
    return jsonify({'summary': summary, 'frames': feedback_frames})

@app.route('/analyze_desk', methods=['POST'])
def analyze_desk():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400
    file = request.files['image']
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp:
        file.save(temp.name)
        image = cv2.imread(temp.name)
    if image is None:
        return jsonify({'error': 'Invalid image'}), 400
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    with mp_pose.Pose(static_image_mode=True) as pose:
        results = pose.process(image_rgb)
        if not results.pose_landmarks:
            return jsonify({'error': 'No person detected'}), 200
        landmarks = results.pose_landmarks.landmark
        # Extract key body landmarks
        left_shoulder = [landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
        right_shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
        left_ear = [landmarks[mp_pose.PoseLandmark.LEFT_EAR.value].x, landmarks[mp_pose.PoseLandmark.LEFT_EAR.value].y]
        right_ear = [landmarks[mp_pose.PoseLandmark.RIGHT_EAR.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_EAR.value].y]
        # Calculate angles
        shoulder_angle = calculate_angle(left_shoulder, right_shoulder, [right_shoulder[0], 0])
        neck_angle = calculate_angle(left_ear, left_shoulder, [left_shoulder[0], 0])
        # Rule-based logic
        feedback = []
        if neck_angle < 30:
            feedback.append('Neck bends > 30° (bad desk posture)')
        if shoulder_angle < 150:
            feedback.append('Back isn’t straight (bad desk posture)')
        if not feedback:
            feedback.append('Good desk posture detected')
        return jsonify({'shoulder_angle': round(shoulder_angle,2), 'neck_angle': round(neck_angle,2), 'feedback': feedback})

@app.route('/analyze_desk_video', methods=['POST'])
def analyze_desk_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video uploaded'}), 400
    file = request.files['video']
    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp:
        file.save(temp.name)
        video_path = temp.name
    cap = cv2.VideoCapture(video_path)
    total_frames = 0
    bad_posture_frames = 0
    feedback_frames = []
    with mp_pose.Pose(static_image_mode=False) as pose:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            total_frames += 1
            if total_frames % 10 != 0:
                continue  # Process every 10th frame
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image_rgb)
            if not results.pose_landmarks:
                continue
            landmarks = results.pose_landmarks.landmark
            left_shoulder = [landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
            right_shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
            left_ear = [landmarks[mp_pose.PoseLandmark.LEFT_EAR.value].x, landmarks[mp_pose.PoseLandmark.LEFT_EAR.value].y]
            right_ear = [landmarks[mp_pose.PoseLandmark.RIGHT_EAR.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_EAR.value].y]
            shoulder_angle = calculate_angle(left_shoulder, right_shoulder, [right_shoulder[0], 0])
            neck_angle = calculate_angle(left_ear, left_shoulder, [left_shoulder[0], 0])
            frame_feedback = []
            if neck_angle < 30:
                frame_feedback.append('Neck bends > 30° (bad desk posture)')
            if shoulder_angle < 150:
                frame_feedback.append('Back isn’t straight (bad desk posture)')
            if frame_feedback:
                bad_posture_frames += 1
            feedback_frames.append({
                'frame': total_frames,
                'shoulder_angle': round(shoulder_angle,2),
                'neck_angle': round(neck_angle,2),
                'feedback': frame_feedback or ['Good desk posture']
            })
    cap.release()
    summary = {
        'total_frames': total_frames,
        'analyzed_frames': len(feedback_frames),
        'bad_posture_frames': bad_posture_frames,
        'bad_posture_percentage': round((bad_posture_frames/len(feedback_frames))*100, 2) if feedback_frames else 0
    }
    return jsonify({'summary': summary, 'frames': feedback_frames})

# No app.run() or if __name__ == '__main__' block below this line.
