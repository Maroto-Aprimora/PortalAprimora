from PIL import Image, ImageDraw
# Gera os ícones do portal a partir dos logos oficiais (pasta Logos do pacote da marca).
# Uso: python3 scripts/gerar-icones.py /caminho/para/Logos
import sys
L=sys.argv[1].rstrip('/')+'/'
AZUL=(0x24,0x47,0x6f,255)
def simbolo(arq, corte):
    im=Image.open(L+arq).convert('RGBA'); w,h=im.size
    s=im.crop((0,0,w,corte)); return s.crop(s.getchannel('A').getbbox())
branco=simbolo('LOGO GRANDE - FUNDO PRETO.png',860)
azul=simbolo('LOGO GRANDE - FUNDO BRANCO.png',870)
def encaixa(s, lado):
    r=lado/max(s.size); return s.resize((round(s.width*r),round(s.height*r)),Image.LANCZOS)
def icone(lado, frac, raio=0, fundo=AZUL):
    big=lado*4
    c=Image.new('RGBA',(big,big),(0,0,0,0))
    m=Image.new('L',(big,big),0); ImageDraw.Draw(m).rounded_rectangle((0,0,big-1,big-1),radius=raio*4,fill=255)
    c.paste(Image.new('RGBA',(big,big),fundo),(0,0),m)
    s=encaixa(branco, big*frac); c.alpha_composite(s,((big-s.width)//2,(big-s.height)//2))
    return c.resize((lado,lado),Image.LANCZOS)
pub='public/'; app='src/app/'
icone(192,0.66).convert('RGB').save(pub+'icone-192.png', optimize=True)
icone(512,0.66).convert('RGB').save(pub+'icone-512.png', optimize=True)
icone(512,0.52).convert('RGB').save(pub+'icone-maskable-512.png', optimize=True)
icone(180,0.66).convert('RGB').save(app+'apple-icon.png', optimize=True)
# favicon.ico (16, 32, 48) para o Google e navegadores antigos
# Favicon: em 16–48px os traços finos somem; engrossa o símbolo antes de reduzir.
from PIL import ImageFilter
def engrossa(s, n):
    # separa o branco e o laranja, engrossa cada traço e remonta com cores sólidas
    px=s.load(); w,h=s.size
    mb=Image.new('L',(w,h),0); ml=Image.new('L',(w,h),0); pb=mb.load(); pl=ml.load()
    for y in range(h):
        for x in range(w):
            r,g,b,a=px[x,y]
            if a<60: continue
            if r>200 and g>200 and b>200: pb[x,y]=a
            elif r>180 and 90<g<200 and b<120: pl[x,y]=a
    out=Image.new('RGBA',(w,h),(0,0,0,0))
    out.paste(Image.new('RGBA',(w,h),(255,255,255,255)),(0,0),mb.filter(ImageFilter.MaxFilter(n)))
    out.paste(Image.new('RGBA',(w,h),(0xe8,0x83,0x3a,255)),(0,0),ml.filter(ImageFilter.MaxFilter(n)))
    return out
grosso={n: engrossa(branco,n) for n in (9,17,25)}
def favicon(lado, n, frac=0.86, raio_frac=0.2):
    global branco
    orig=branco; branco=grosso[n]
    im=icone(lado,frac,raio=round(lado*raio_frac)); branco=orig; return im
f16,f32,f48=favicon(16,25),favicon(32,17),favicon(48,17)
f48.save(app+'favicon.ico', sizes=[(16,16),(32,32),(48,48)], append_images=[f16,f32])
favicon(96,9).save(app+'icon.png', optimize=True)

# Marca nas telas: tile do app (menu e topo do celular) e logo vertical do login
favicon(96,9).save(pub+'marca-app.png', optimize=True)
g=Image.open(L+'LOGO GRANDE - FUNDO PRETO.png').convert('RGBA'); g=g.crop(g.getchannel('A').getbbox())
encaixa(g,560).save(pub+'logo-vertical-branca.png', optimize=True)
