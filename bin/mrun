#!/usr/bin/env bash

# For sure can do a better DRY job here, but no time right now
if [ -n "$METEOR_APP_HOME" ]; then
 if [ -n "$METEOR_SETTINGS_PATH" ]; then
    cd $METEOR_APP_HOME && meteor --settings $METEOR_SETTINGS_PATH $@
  else
    cd $METEOR_APP_HOME && meteor $@
  fi
else
 if [ -n "$METEOR_SETTINGS_PATH" ]; then
    cd $METEOR_APP_HOME && meteor --settings $METEOR_SETTINGS_PATH $@
  else
    cd $METEOR_APP_HOME && meteor $@
  fi
fi
