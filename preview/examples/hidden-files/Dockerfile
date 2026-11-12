# Misc lab: Hidden Files (files whose names start with a dot).
#
# The CyberRange starts one copy of this image per student and passes that student's flag
# in the GZCTF_FLAG environment variable, so the image never contains a flag.
#
# Build:  docker build -t club/hidden-files:latest .
FROM python:3.13-alpine

COPY app.py /app/app.py

EXPOSE 80
CMD ["python", "/app/app.py"]
