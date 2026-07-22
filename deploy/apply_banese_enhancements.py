#!/usr/bin/env python3
"""Apply Banese visual enhancements and deploy to Railway."""
import os, sys, subprocess, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def run_cmd(cmd, cwd=ROOT):
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return result.stdout, result.stderr, result.returncode

def main():
    # 1. Add confettiAnimation function to cadastro.js after closePopup
    js_path = os.path.join(ROOT, 'cadastro.js')
    js = read_file(js_path)

    confetti_func = '''
  /* ============================================================
     CONFETTI ANIMATION (premium, discreto)
     ============================================================ */
  function confettiAnimation(duration) {
    var container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    var colors = ['#4CC8A4','#3B82F6','#FBBF24','#EF4444','#8B5CF6','#F472B6','#06B6D4'];
    var pieces = 60;
    for (var i = 0; i < pieces; i++) {
      var el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText =
        'left:'+(Math.random()*100)+'%;'+
        'top:'+(-10-Math.random()*20)+'%;'+
        'width:'+(6+Math.random()*8)+'px;'+
        'height:'+(6+Math.random()*8)+'px;'+
        'background:'+colors[Math.floor(Math.random()*colors.length)]+';'+
        'animation-duration:'+(1.5+Math.random()*2)+'s;'+
        'animation-delay:'+(Math.random()*0.5)+'s;'+
        'transform:rotate('+(Math.random()*360)+'deg);'+
        'border-radius:'+(Math.random()>0.5?'50%':'2px')+';'+
        'opacity:'+(0.5+Math.random()*0.5);
      container.appendChild(el);
    }
    setTimeout(function(){ container.remove(); }, duration + 1000);
  }
'''

    # Insert confetti function after closePopup
    marker = '  function closePopup() {\n    if (popupEl) { popupEl.remove(); popupEl = null; }\n  }'
    if marker in js:
        js = js.replace(marker, marker + confetti_func)
        write_file(js_path, js)
        print('OK: confettiAnimation added to cadastro.js')
    else:
        print('FAIL: Could not find closePopup marker in cadastro.js')
        return False

    # 2. Add gerarCardBaneseSVG function (enhanced Visa Infinite style)
    banese_card_func = '''
  /* ============================================================
     FUNCAO: Cartao SVG Banese Premium (Visa Infinite, verde escuro, chip metalico)
     ============================================================ */
  function gerarCardBaneseSVG(nome, limite, ultimos4) {
    var nd = abreviarNome(nome || 'CLIENTE BANESE');
    var u4 = String(ultimos4 || '4589').padStart(4,'0').slice(0,4);
    var lim = Number(limite || 0).toFixed(2).replace('.',',');
    return '<svg viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:16px;filter:drop-shadow(0 8px 32px rgba(4,120,87,0.3));">'+
      '<defs>'+
        '<linearGradient id="baneseCardBg" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#022c22"/>'+
          '<stop offset="35%" stop-color="#064E3B"/>'+
          '<stop offset="70%" stop-color="#065F46"/>'+
          '<stop offset="100%" stop-color="#047857"/>'+
        '</linearGradient>'+
        '<radialGradient id="baneseCardShine" cx="30%" cy="20%" r="80%">'+
          '<stop offset="0%" stop-color="rgba(255,255,255,0.15)"/>'+
          '<stop offset="50%" stop-color="rgba(255,255,255,0.03)"/>'+
          '<stop offset="100%" stop-color="transparent"/>'+
        '</radialGradient>'+
        '<linearGradient id="baneseChipMetal" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#fef3c7"/>'+
          '<stop offset="30%" stop-color="#fbbf24"/>'+
          '<stop offset="60%" stop-color="#f59e0b"/>'+
          '<stop offset="100%" stop-color="#d97706"/>'+
        '</linearGradient>'+
        '<linearGradient id="baneseTextGlow" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#ffffff"/>'+
          '<stop offset="100%" stop-color="rgba(255,255,255,0.7)"/>'+
        '</linearGradient>'+
      '</defs>'+
      '<rect width="340" height="210" rx="16" fill="url(#baneseCardBg)"/>'+
      '<rect width="340" height="210" rx="16" fill="url(#baneseCardShine)"/>'+
      '<circle cx="260" cy="25" r="140" fill="rgba(255,255,255,0.03)"/>'+
      '<circle cx="300" cy="45" r="80" fill="rgba(255,255,255,0.02)"/>'+
      '<circle cx="30" cy="180" r="60" fill="rgba(255,255,255,0.015)"/>'+
      '<text x="28" y="40" font-family="Space Grotesk,Arial,sans-serif" font-size="12" font-weight="900" fill="rgba(255,255,255,0.7)" letter-spacing="3">BANESE</text>'+
      '<text x="170" y="40" font-family="Space Grotesk,Arial,sans-serif" font-size="10" font-weight="800" fill="rgba(255,255,255,0.3)" text-anchor="middle">*</text>'+
      '<text x="200" y="40" font-family="Space Grotesk,Arial,sans-serif" font-size="10" font-weight="800" fill="rgba(255,255,255,0.5)" letter-spacing="2">CREDVALE</text>'+
      '<rect x="28" y="68" width="44" height="32" rx="5" fill="url(#baneseChipMetal)" opacity="0.9"/>'+
      '<rect x="31" y="71" width="38" height="26" rx="3" fill="rgba(255,255,255,0.06)"/>'+
      '<text x="28" y="138" font-family="Courier New,monospace" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="3.5" opacity="0.95">****  ****  ****  '+u4+'</text>'+
      '<text x="28" y="168" font-family="Arial,sans-serif" font-size="8" fill="rgba(255,255,255,0.35)" letter-spacing="1">TITULAR</text>'+
      '<text x="28" y="188" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="url(#baneseTextGlow)">'+nd+'</text>'+
      '<text x="312" y="168" font-family="Arial,sans-serif" font-size="8" fill="rgba(255,255,255,0.35)" text-anchor="end" letter-spacing="1">VALIDADE</text>'+
      '<text x="312" y="188" font-family="Arial,sans-serif" font-size="13" font-weight="600" fill="#ffffff" text-anchor="end">12/30</text>'+
      '<text x="28" y="203" font-family="Arial,sans-serif" font-size="6.5" fill="rgba(255,255,255,0.2)" letter-spacing="0.8">Este cartao e emitido sob parceria BANESE - CREDVALE</text>'+
      (limite ? '<text x="170" y="203" font-family="Arial,sans-serif" font-size="8" fill="rgba(255,255,255,0.4)" text-anchor="middle" font-weight="600">Limite: R$ '+lim+'</text>' : '')+
    '</svg>';
  }
'''

    # Insert after gerarCardPremium function
    card_marker = "    '</svg></div>';\n  }\n\n  /* ---- Chat UI ---- */"
    if card_marker in js:
        # Need to re-read since js was modified
        js = read_file(js_path)
        js = js.replace(card_marker, banese_card_func + "\n  /* ---- Chat UI ---- */")
        write_file(js_path, js)
        print('OK: gerarCardBaneseSVG added to cadastro.js')
    else:
        print('FAIL: Could not find card marker')
        return False

    # 3. Add CSS to cadastro-chat.css
    css_path = os.path.join(ROOT, 'cadastro-chat.css')
    css = read_file(css_path)

    confetti_css = '''
/* ============================================================
   CONFETTI ANIMATION (premium, discreto)
   ============================================================ */
.confetti-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 99999;
  overflow: hidden;
}
.confetti-piece {
  position: absolute;
  animation: confettiFall var(--duration, 2s) ease-out forwards;
}
@keyframes confettiFall {
  0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg) scale(0.3); opacity: 0; }
}

/* ============================================================
   TELA DE APROVACAO PREMIUM
   ============================================================ */
.approval-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 10px 0 4px;
}
.approval-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 50px;
  background: linear-gradient(135deg, rgba(4,120,87,0.1), rgba(16,185,129,0.08));
  border: 1px solid rgba(4,120,87,0.2);
  font-size: 0.75rem;
  font-weight: 700;
  color: #047857;
  margin-bottom: 12px;
}
.approval-badge .badge-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #10B981;
  animation: pulse 1.8s ease-in-out infinite;
}
.approval-title {
  font-family: Space Grotesk, sans-serif;
  font-size: 1.6rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 4px;
  letter-spacing: -0.03em;
}
.approval-title .highlight {
  background: linear-gradient(135deg, #047857, #10B981);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.approval-card-wrap {
  width: 100%;
  max-width: 300px;
  margin: 0 auto 16px;
  position: relative;
  animation: cardFloatIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes cardFloatIn {
  0% { opacity: 0; transform: translateY(30px) scale(0.9) rotateY(15deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotateY(0deg); }
}
.approval-card-wrap .approval-glow-ring {
  position: absolute;
  inset: -8px;
  border-radius: 20px;
  background: radial-gradient(circle at 50% 50%, rgba(16,185,129,0.25), transparent 70%);
  animation: glowPulse 2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes glowPulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
.approval-cta {
  width: 100%;
  padding: 16px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #047857, #10B981);
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(4,120,87,0.25);
}
.approval-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(4,120,87,0.35); }
.approval-cta:active { transform: scale(0.97); }
'''

    # Find a good insertion point in CSS
    if '/* ============================================================' in css:
        css = confetti_css + '\n' + css
        write_file(css_path, css)
        print('OK: CSS added to cadastro-chat.css')
    else:
        print('FAIL: CSS insertion point not found')
        return False

    # 4. Copy to dist/
    import shutil
    for f in ['cadastro.js', 'cadastro-chat.css', 'cadastro.css']:
        src = os.path.join(ROOT, f)
        dst = os.path.join(ROOT, 'dist', f)
        shutil.copy2(src, dst)
        print(f'OK: Copied {f} to dist/')

    # 5. Git commit and push
    print('\n--- Git operations ---')
    out1, err1, code1 = run_cmd('git add -A')
    print(out1 + err1)

    out2, err2, code2 = run_cmd('git commit -m "feat: Banese premium card SVG, confetti animation, CSS"')
    print(out2 + err2)

    out3, err3, code3 = run_cmd('git push origin main')
    print(out3 + err3)

    if code3 == 0:
        print('\nDEPLOY TRIGGERED: Railway will auto-deploy from GitHub')
        return True
    else:
        print(f'\nPush failed (code {code3}). Retrying with pull first...')
        out4, err4, code4 = run_cmd('git pull origin main --no-rebase --strategy-option theirs')
        print(out4 + err4)

        out5, err5, code5 = run_cmd('git push origin main')
        print(out5 + err5)
        return code5 == 0

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
