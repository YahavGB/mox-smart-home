#!/usr/bin/env bash

# Setup
INIT_LOCKFILE="`basename $0`.lock"

# Remove the old lockfile (For debug)
if [[ $1 == 1 ]]; then
    rm -rf "$INIT_LOCKFILE"
fi

# Check if our initialization lockfile exists
if [ ! -f "$INIT_LOCKFILE" ]; then
    # Lock
    touch "$INIT_LOCKFILE"

    # Attempt to create the database
    npm run init:prod
    retVal=$?
    if [ $retVal -ne 0 ]; then
        echo "**** ERROR: Could not initialize the database ***"
        rm -rf "$INIT_LOCKFILE"
        exit 1
    fi
fi

echo "***** Starting MOX daemon *****"
npm run daemon:prod