#!/bin/bash

# Question Enforcement Hook
# Blocks responses that ask plain-text questions without using AskUserQuestion tool
# This is the mechanical enforcement layer for the question-asking protocol

# Read the response from stdin
response=$(cat)

# Check if response contains AskUserQuestion tool invocation
has_ask_tool=$(echo "$response" | grep -c "AskUserQuestion\|mcp__claude-in-chrome__*\|AskUserQuestion")

# Detect plain-text questions (lines ending with ? that aren't in code blocks)
# Pattern: line with interrogative word or ending with ?
# But exclude: code blocks (```), quoted text (> ), examples

# Extract non-code-block content
non_code=$(echo "$response" | sed '/^```/,/^```/d')

# Look for questions: lines that end with ? and start with interrogative words or are standalone questions
# Exclude: markdown lists (> ), code fence markers, numbered lists in examples
questions=$(echo "$non_code" | grep -E '^\s*(What|How|Should|Can|Is|Does|Why|When|Where|Who|Could|Would|Will|Are|Did|Have|Has|Do|May|Might|Must|Shall|Do you|Can you|Have you|Has.*\?|[^?]*\?)$' | grep '?' | grep -v '^>' | grep -v '^\*\*' | grep -v '^-')

question_count=$(echo "$questions" | grep -c . || echo 0)

# If we found questions but no AskUserQuestion tool, this is a violation
if [ "$question_count" -gt 0 ] && [ "$has_ask_tool" -eq 0 ]; then
  cat >&2 << 'EOF'

╔════════════════════════════════════════════════════════════════════════════╗
║                    QUESTION ENFORCEMENT BLOCK                              ║
║                                                                            ║
║  You asked a plain-text question without using AskUserQuestion.           ║
║  This violates the mandatory question-asking protocol.                    ║
║                                                                            ║
║  REQUIRED: Use the AskUserQuestion tool with 2-3 concrete options.        ║
║                                                                            ║
║  Questions detected:                                                       ║
EOF
  echo "$questions" | sed 's/^/║  - /' >&2
  cat >&2 << 'EOF'
║                                                                            ║
║  Reframe as multiple-choice options and use AskUserQuestion instead.      ║
╚════════════════════════════════════════════════════════════════════════════╝

EOF
  exit 1
fi

# If validation passes, output the response
echo "$response"
exit 0
