#!/bin/bash -e

coffee -o lib -c src
coffee -o tests/lib -c tests/src
mocha --colors --reporter spec tests/lib/*Test*.js
