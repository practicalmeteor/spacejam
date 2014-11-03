#!/bin/bash -xe

usage="Usage: mtag package-build"

if [ -z "$1" ]; then
  >&2 echo "Error: Missing argument."
  >&2 echo $usage
  exit 1
fi

if [ "$1" != "package-build" ]; then
  >&2 echo "Error: Invalid argument."
  >&2 echo $usage
  exit 1
fi

if [ -z "$TRAVIS_BUILD_NUMBER" ]
then
  >&2 echo "Error: TRAVIS_BUILD_NUMBER is not set."
  exit 1
fi

package_version=$(spacejam package-version)

# Need to enclose $package_version in quotes, otherwise semver will exit with 0, since it found at least one valid version.
semver "$package_version"

tag_name="build/v$package_version+$TRAVIS_BUILD_NUMBER"

git tag $tag_name
git push origin $tag_name
