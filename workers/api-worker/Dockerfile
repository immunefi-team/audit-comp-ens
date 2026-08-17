FROM postgres:17

# Install necessary packages for building PostgreSQL extensions
RUN apt-get update && \
    apt-get install -y \
    build-essential \
    postgresql-server-dev-17 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Download and install pg_uuidv7
RUN curl -L https://github.com/fboulnois/pg_uuidv7/archive/refs/tags/v1.6.0.tar.gz -o pg_uuidv7.tar.gz && \
    tar -xzf pg_uuidv7.tar.gz && \
    cd pg_uuidv7-1.6.0 && \
    make && \
    make install && \
    cd .. && \
    rm -rf pg_uuidv7-1.6.0 pg_uuidv7.tar.gz

# Clean up build dependencies to reduce image size
RUN apt-get purge -y build-essential postgresql-server-dev-17 curl git && \
    apt-get autoremove -y && \
    apt-get clean
