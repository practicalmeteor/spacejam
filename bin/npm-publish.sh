#!/bin/bash -e

version=$1

if [ -z "$version" ]
then
  echo "ERROR: No package version supplied. Exiting..." >&2
  exit 1
fi

npm test
testStatus=$?

if [ $testStatus -gt 0 ]
then
  echo "ERROR: npm test failed. Exiting..." >&2
  exit 1
fi

echo "Bumping package version to $version"
npm version $version -m "Bumping package version to (%s)"
git push origin master
git push origin v$version
npm publish
