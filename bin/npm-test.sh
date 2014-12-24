#!/bin/bash

coffee -o lib -c src
coffee -o tests/lib -c tests/src
ls tests/lib
grep 'only' tests/lib/*
mocha --colors --reporter spec tests/lib/*Test*.js
