import cv2
import os

video_path = "/home/ubuntu/upload/_users_01912768-4157-4192-a5b0-0f6e69c96add_generated_e7395394-fd94-4575-b269-50289fb74e2e_generated_video.mp4"
cap = cv2.VideoCapture(video_path)

fps = cap.get(cv2.CAP_PROP_FPS)
frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

print(f"FPS: {fps}, Frames: {frame_count}, Resolution: {width}x{height}")

os.makedirs("/home/ubuntu/degen-vegas-landing/extracted_frames", exist_ok=True)
success, frame = cap.read()
count = 0
while success and count < 5:
    out_path = f"/home/ubuntu/degen-vegas-landing/extracted_frames/frame_{count}.jpg"
    cv2.imwrite(out_path, frame)
    print(f"Saved {out_path}")
    for _ in range(int(fps)): # skip 1 second
        cap.read()
    success, frame = cap.read()
    count += 1

cap.release()
