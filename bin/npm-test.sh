#!/bin/bash -e

coffee -o lib -c src
coffee -o tests/lib -c tests/src
mocha --colors --compilers coffee:coffee-script/register --reporter spec tests/src/*Test*.coffee
