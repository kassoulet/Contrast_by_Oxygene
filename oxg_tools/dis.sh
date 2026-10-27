#!/bin/bash
# dis.sh START END   (hex, no 0x): compact listing from oxg_out/code.asm
awk -v s="$(printf %08X 0x$1)" -v e="$(printf %08X 0x$2)" '($1 "")>=(s "") && ($1 "")<(e "") {printf "%s ", substr($1,4); for(i=3;i<=NF;i++) printf "%s ", $i; printf "\n"}' "$(dirname "$0")/../oxg_out/code.asm"
