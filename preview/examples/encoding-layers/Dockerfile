# Beginner crypto challenge: Encoding Layers (encodings are not encryption).
#
# GZCTF starts one copy of this image per player and passes that player's flag in the
# GZCTF_FLAG environment variable, so the image never contains a flag.
#
# Build:  docker build -t club/encoding-layers:latest .
FROM python:3.13-alpine

COPY app.py /app/app.py

EXPOSE 80
CMD ["python", "/app/app.py"]
