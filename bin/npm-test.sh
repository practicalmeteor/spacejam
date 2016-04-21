#!/bin/bash -e

mocha --colors --compilers coffee:coffee-script/register --reporter spec tests/lib/*Test*.coffee
