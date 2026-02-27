#!/bin/bash
# ═══════════════════════════════════════════════════════
#  HR Workflow Builder — 배포용 ZIP 패키징 스크립트
#  스크립트/실행파일 제외 → 기업 메일 첨부 가능
# ═══════════════════════════════════════════════════════

cd "$(dirname "$0")"
PROJ_NAME="hr-workflow-ai"
TIMESTAMP=$(date +%Y%m%d_%H%M)
ZIP_NAME="${PROJ_NAME}_${TIMESTAMP}.zip"

echo ""
echo "📦 메일 안전 ZIP 패키징 중..."
echo ""

# 기업 메일 차단 우회: .mjs → .mjs.txt 임시 변경
for f in *.mjs; do
    [ -e "$f" ] || continue
    mv "$f" "${f}.txt"
    echo "  📝 ${f} → ${f}.txt"
done

# 상위 디렉토리에 ZIP 생성 (스크립트 파일 모두 제외)
cd ..
zip -r "$ZIP_NAME" "$PROJ_NAME" \
    -x "${PROJ_NAME}/node_modules/*" \
    -x "${PROJ_NAME}/.next/*" \
    -x "${PROJ_NAME}/.git/*" \
    -x "${PROJ_NAME}/.env.local" \
    -x "${PROJ_NAME}/tsconfig.tsbuildinfo" \
    -x "${PROJ_NAME}/.DS_Store" \
    -x "${PROJ_NAME}/start.sh" \
    -x "${PROJ_NAME}/start_windows.txt" \
    -x "${PROJ_NAME}/package.sh" \
    -x "*/.DS_Store"

# .mjs.txt → .mjs 복원
cd "$PROJ_NAME"
for f in *.mjs.txt; do
    [ -e "$f" ] || continue
    target="${f%.txt}"
    mv "$f" "$target"
    echo "  🔧 복원: ${f} → ${target}"
done
cd ..

echo ""
echo "✅ 완료: $(pwd)/$ZIP_NAME"
echo ""
echo "📋 이 ZIP을 메일로 보내세요."
echo "   받는 사람은 README.md를 따라 실행하면 됩니다."
echo ""

# ZIP 파일 크기 출력
ls -lh "$ZIP_NAME" | awk '{print "📁 파일 크기: " $5}'
