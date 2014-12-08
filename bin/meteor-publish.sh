#!/bin/bash -xe

if [ -n "$(git status --porcelain)" ]; then
  echo "The git working directory is not clean. Exiting."
  exit 1
fi

spacejam test-packages ./
version=$(spacejam package-version)
tag_name="v${version}"
meteor publish $@
git tag $tag_name
git push origin $tag_name
