import re, pathlib

root = pathlib.Path(".")
html_files = [p for p in root.rglob("*.html")]

# Helpers
protofix = re.compile(r'(?<=["\'])//')
def httpsify(u: str) -> str:
    u = protofix.sub('https://', u)
    return u.replace('http://', 'https://')

# Patterns
img_tag = re.compile(r'<img\b', re.I)
data_src_attr     = re.compile(r'data-src=(["\'])(.+?)\1',      re.I|re.S)
data_srcset_attr  = re.compile(r'data-srcset=(["\'])(.+?)\1',   re.I|re.S)
data_image_attr   = re.compile(r'data-image=(["\'])(.+?)\1',    re.I|re.S)

for fp in html_files:
    txt = fp.read_text(encoding="utf-8", errors="ignore")
    orig = txt

    # data-src -> src
    txt = data_src_attr.sub(lambda m: f'src="{httpsify(m.group(2))}"', txt)

    # data-srcset -> srcset (keeps responsive rules)
    txt = data_srcset_attr.sub(lambda m: f'srcset="{httpsify(m.group(2))}"', txt)

    # Handle data-image:
    # If it appears inside an <img ...> tag -> src=
    # Else -> add/merge style="background-image:ur    # Else -> add/merge style="backgor     # Else -> addttr    #iter(txt):
        s        s        s        s        s        s.gr                  s        s        s        s start].lower()
        after  =        after  =        after  =  ower()
        is_img_context = ('<img' in before) or ('<img' in after)

        if is_img_conte        if is_img_conte        if is_img_conte        if is_img_conte  o ap        if is_img_conte        if is_img_conte        if is_img_conte     s        if is_img_conte        if is_img_conte        if is_img_conte              nd   = txt.find        if is_img_conte        if is_img_conte        if -1:
                                 _start:tag_end]
                style_m = re.search(r'style=(["\'])(.*?)\1', ta                style_m = re.search(r'style=(["\'])                  style_m = re.search(r'style=(["\'])(.*?)\1', ta                s= old_style
                                                                                                                                                                                                                                                                                                                                         tag_txt_new = (tag_txt[:style_m.start()] + style_new_attr + tag_txt[style_m.end():])
                else:
                    style_new_attr = f'style="background-image:url({url})"'
                    # insert style right after tag name
                    tag_txt_new = re.sub(r'^(<\s*\w+)', r'\1 ' + style_new_attr, tag_txt, count=1)
                txt = txt[:tag_start] + tag_txt_new + txt[tag_end:]
                # Recompute offsets after modifying txt
                shift = len(tag_txt_new) - len(tag_txt)
                start += shift
                end   += shift
            repl = f''  # remove the data-image attribute itself

        out.append(txt[i:start])
        out.append(repl)
        i = end
    out.append(txt[i:])
    txt = ''.join(out)

    if txt != orig:
        fp.write_text(txt, encoding="utf-8")
        print(f"rewrote: {fp}")
