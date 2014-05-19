#!/usr/bin/env bash

version=$1

if [ $version ]
then
    cake test
    testStatus=$?

    if [ $testStatus -gt 0 ]
    then
        echo "Test failed. Exiting...";
        exit 1;
    else
        echo "Bump new version"
        npm version $version -m "Bump new version (%s)"
        git push origin master
        git push origin v$version
        npm publish
        exit 0;
    fi
else
  echo "No version supplied. Exiting...";
  exit 1;
fi