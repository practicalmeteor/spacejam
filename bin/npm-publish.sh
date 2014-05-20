#!/usr/bin/env bash

version=$1

if [ $version ]
then
    npm test
    testStatus=$?

    if [ $testStatus -gt 0 ]
    then
        echo "ERROR: npm test failed. Exiting..." >&2
        exit 1
    else
        echo "Bumping package version to $version"
        npm version $version -m "Bump package version to (%s)"
        git push origin master
        git push origin v$version
        npm publish
        exit 0
    fi
else
  echo "ERROR: No package version supplied. Exiting..." >&2
  exit 1
fi