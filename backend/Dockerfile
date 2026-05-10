FROM python:3.12-slim

# Prevent Python from writing .pyc files and ensure output is sent directly to the logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies for PostGIS and building Python packages
RUN apt-get update && apt-get install -y \
    binutils \
    libproj-dev \
    gdal-bin \
    libgdal-dev \
    python3-gdal \
    gcc \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Prepare static files for WhiteNoise
RUN python manage.py collectstatic --no-input

# Render uses the $PORT environment variable
EXPOSE 10000

# Run migrations, then start the Daphne server
CMD daphne -b 0.0.0.0 -p $PORT backend.asgi:application