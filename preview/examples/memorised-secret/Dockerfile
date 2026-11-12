# AI lab: Memorised Secret (a model that repeats its training data).
#
# The CyberRange starts one copy of this image per student and passes that student's flag
# in the GZCTF_FLAG environment variable, so the image never contains a flag.
#
# Build:  docker build -t club/memorised-secret:latest .
FROM python:3.13-alpine

COPY app.py /app/app.py

EXPOSE 80
CMD ["python", "/app/app.py"]
