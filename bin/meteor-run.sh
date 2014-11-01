#!/usr/bin/env bash

if [ -n "$METEOR_SETTINGS_PATH" ]; then
  meteor --settings $METEOR_SETTINGS_PATH $@
else
  meteor $@
fi
