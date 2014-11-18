#!/usr/bin/env bash

if [ -n "$TEST_PORT" ]; then
  export PORT="$TEST_PORT"
else
  export PORT="3100"
fi

if [ -n "$TEST_ROOT_URL" ]; then
  export ROOT_URL="$TEST_ROOT_URL"
else
  export ROOT_URL="http://localhost:$PORT/"
fi

if [ -n "$TEST_MONGO_URL" ]; then
  export MONGO_URL="$TEST_MONGO_URL"
else
  unset MONGO_URL
fi

if [ -n "$TEST_METEOR_SETTINGS_PATH" ]; then
  METEOR_SETTINGS_PATH="$TEST_METEOR_SETTINGS_PATH"
fi

if [ -n "$METEOR_SETTINGS_PATH" ]; then
  # The space at the end is to put a space before --port
  METEOR_SETTINGS_ARGS="--settings $METEOR_SETTINGS_PATH"
fi

meteor test-packages --port $PORT ${METEOR_SETTINGS_ARGS} $@
