#!/bin/bash
cd /home/kavia/workspace/code-generation/memory-card-match-game-199717-199726/memory_card_match_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

