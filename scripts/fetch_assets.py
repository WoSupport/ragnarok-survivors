#!/usr/bin/env python3
"""
Downloads and packs authentic Ragnarok Online assets (character sprites, monster
animations, skill/item/job icons, full card artworks, map ground textures,
minimaps, UI cursor, SFX wavs, and SoundTeMP BGM mp3s) into local files under
public/assets/ for fast, reliable zero-latency browser gameplay.
"""
import io
import json
import os
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "public", "assets")
RAGASSETS = "https://assets.latam-tools.com.br"
RMS_CDN = "https://file5s.ratemyserver.net"

for sub in ["heroes", "mobs", "icons/skill", "icons/item", "icons/job", "cards", "maps", "ui", "sfx", "bgm"]:
    os.makedirs(os.path.join(ASSETS_DIR, sub), exist_ok=True)


def fetch_bytes(url, retries=3, timeout=18):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(0.5 * (attempt + 1))


def unpack_apng_to_strip(apng_bytes, out_png_path, anchor_x, anchor_y):
    """
    Unpacks an APNG into a tightly cropped horizontal sprite strip PNG and returns
    frame metadata with exact preserved foot-anchor coordinates.
    """
    im = Image.open(io.BytesIO(apng_bytes))
    n_frames = getattr(im, "n_frames", 1)
    frames = []
    durations = []
    bboxes = []

    for i in range(n_frames):
        im.seek(i)
        dur = int(im.info.get("duration", 100) or 100)
        rgba = im.convert("RGBA")
        frames.append(rgba)
        durations.append(max(40, min(dur, 400)))
        bb = rgba.getbbox()
        if bb:
            bboxes.append(bb)

    if not bboxes:
        w, h = frames[0].size
        crop_box = (0, 0, w, h)
    else:
        min_x = max(0, min(b[0] for b in bboxes) - 2)
        min_y = max(0, min(b[1] for b in bboxes) - 2)
        max_x = min(frames[0].width, max(b[2] for b in bboxes) + 2)
        max_y = min(frames[0].height, max(b[3] for b in bboxes) + 2)
        crop_box = (min_x, min_y, max_x, max_y)

    fw = max(1, crop_box[2] - crop_box[0])
    fh = max(1, crop_box[3] - crop_box[1])
    new_ax = anchor_x - crop_box[0]
    new_ay = anchor_y - crop_box[1]

    strip = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for idx, fr in enumerate(frames):
        cropped = fr.crop(crop_box)
        strip.paste(cropped, (idx * fw, 0))

    strip.save(out_png_path, format="PNG", optimize=True)
    return {
        "frames": len(frames),
        "fw": fw,
        "fh": fh,
        "ax": new_ax,
        "ay": new_ay,
        "durations": durations,
    }


HERO_CLASSES = [
    {
        "id": "lord_knight",
        "job": 4008,
        "male": {"head": 2, "headPalette": 6, "weapon": 2, "shield": 1, "headgear": "50"},
        "female": {"head": 4, "headPalette": 6, "weapon": 2, "shield": 1, "headgear": "50"},
    },
    {
        "id": "high_wizard",
        "job": 4010,
        "male": {"head": 1, "headPalette": 3, "weapon": 10, "headgear": "19"},
        "female": {"head": 3, "headPalette": 3, "weapon": 10, "headgear": "19"},
    },
    {
        "id": "sniper",
        "job": 4012,
        "male": {"head": 5, "headPalette": 2, "weapon": 11, "headgear": "45"},
        "female": {"head": 2, "headPalette": 2, "weapon": 11, "headgear": "45"},
    },
    {
        "id": "assassin_cross",
        "job": 4013,
        "male": {"head": 6, "headPalette": 1, "weapon": 16, "headgear": "28"},
        "female": {"head": 6, "headPalette": 1, "weapon": 16, "headgear": "28"},
    },
    {
        "id": "high_priest",
        "job": 4009,
        "male": {"head": 3, "headPalette": 4, "weapon": 10, "shield": 1, "headgear": "14"},
        "female": {"head": 4, "headPalette": 4, "weapon": 10, "shield": 1, "headgear": "14"},
    },
    {
        "id": "champion",
        "job": 4016,
        "male": {"head": 1, "headPalette": 8, "weapon": 12, "headgear": "22"},
        "female": {"head": 5, "headPalette": 8, "weapon": 12, "headgear": "22"},
    },
]

# Poses per hero: (pose_key, action_idx, dir_idx)
HERO_POSES = [
    ("idle_s", 0, 1),
    ("idle_n", 0, 3),
    ("walk_s", 1, 0),
    ("walk_sw", 1, 1),
    ("walk_w", 1, 2),
    ("walk_nw", 1, 3),
    ("walk_n", 1, 4),
    ("atk_s", 5, 1),
    ("atk_n", 5, 3),
    ("cast_s", 12, 1),
    ("dead", 8, 0),
]

MOBS = [
    # Zone 1: South Prontera Field
    1002, 1063, 1007, 1052, 1031, 1090, 1096, 1086,
    # Zone 2: Payon Cave
    1015, 1076, 1026, 1188, 1170, 1115, 1150,
    # Zone 3: Morroc Pyramids
    1005, 1041, 1032, 1029, 1149, 1159, 1038,
    # Zone 4: Geffen Dungeon
    1179, 1036, 1143, 1109, 1061, 1389, 1046,
    # Zone 5: Orc Village & Dungeon
    1023, 1273, 1189, 1213, 1152, 1087, 1190,
    # Zone 6: Glast Heim Chivalry
    1163, 1276, 1132, 1208, 1219, 1268, 1039, 1272,
]

SKILL_IDS = [
    5, 7, 17, 18, 19, 21, 26, 28, 29, 33, 34, 45, 46, 47, 62,
    70, 73, 75, 79, 83, 84, 85, 89, 123, 129, 135, 136, 137, 138,
    150, 156, 261, 263, 264, 267, 270, 355, 359, 378, 380, 397, 406
]

ITEM_IDS = [
    501, 503, 504, 505, 603, 607, 608, 617, 909, 984, 985, 4001, 7444, 7539
]

CARD_IDS = [
    4001, 4035, 4047, 4058, 4092, 4121, 4128, 4131, 4134, 4140, 4142, 4147
]

MAPS = ["prt_fild08", "pay_dun00", "moc_pryd01", "gef_dun01", "gef_fild10", "gl_knt01"]

SOUNDS = {
    "levelup": "levelup",
    "mvp": "effect/st_mvp",
    "bowling_bash": "bowling_bash",
    "bash": "effect/ef_bash",
    "magnum_break": "effect/ef_magnumbreak",
    "spiral_pierce": "permeter_attack",
    "storm_gust": "effect/wizard_stormgust",
    "meteor_storm": "effect/wizard_meteor",
    "thunderstorm": "effect/magician_thunderstorm",
    "magnus": "effect/priest_magnus",
    "sanctuary": "effect/priest_sanctuary",
    "kyrie": "effect/priest_kyrie_eleison_a",
    "blessing": "effect/ef_blessing",
    "inc_agi": "effect/ef_incagility",
    "heal": "_heal_effect",
    "blitz_beat": "effect/hunter_blitzbeat",
    "sonic_blow": "effect/assasin_sonicblow",
    "cloaking": "effect/assasin_cloaking",
    "teleport": "effect/ef_teleportation",
    "arrow_hit": "_hit_arrow",
    "hit1": "_enemy_hit1",
    "hit2": "_enemy_hit2",
    "coin": "se_get_coin",
    "potion": "se_drink_potion",
    "poring_die": "king_poring_die",
}

BGM_TRACKS = {
    "title": "08.mp3",       # Theme of Prontera
    "prt_fild08": "12.mp3",  # Streamside
    "pay_dun00": "20.mp3",   # Ancient Groover
    "moc_pryd01": "22.mp3",  # Backattack!!
    "gef_dun01": "21.mp3",   # Through the Tower
    "gef_fild10": "05.mp3",  # Tread on the Ground
    "gl_knt01": "44.mp3",    # Curse'n Pain
}


def main():
    manifest = {
        "heroes": {},
        "mobs": {},
        "maps": {},
        "ui": {},
        "sfx": {},
        "bgm": {},
    }

    tasks = []

    with ThreadPoolExecutor(max_workers=6) as pool:
        # 1. Heroes
        print("Fetching 6 RO Hero classes (Male & Female, 11 poses each)...")
        hero_futures = {}
        for h in HERO_CLASSES:
            hid = h["id"]
            manifest["heroes"][hid] = {"male": {}, "female": {}}
            for gender in ("male", "female"):
                cfg = h[gender]
                for pose_key, act_idx, dir_idx in HERO_POSES:
                    out_rel = f"heroes/{hid}_{gender}_{pose_key}.png"
                    out_abs = os.path.join(ASSETS_DIR, out_rel)
                    params = {
                        "job": str(h["job"]),
                        "gender": gender,
                        "head": str(cfg["head"]),
                        "headPalette": str(cfg["headPalette"]),
                        "action": str(act_idx * 8 + dir_idx),
                        "headdir": "0",
                        "canvas": "208x210+104+152",
                    }
                    if "weapon" in cfg:
                        params["weapon"] = str(cfg["weapon"])
                    if "shield" in cfg:
                        params["shield"] = str(cfg["shield"])
                    if "headgear" in cfg:
                        params["headgear"] = str(cfg["headgear"])
                    url = f"{RAGASSETS}/image?{urllib.parse.urlencode(params)}"

                    def job_hero(u=url, p=out_abs, rel=out_rel):
                        data = fetch_bytes(u)
                        meta = unpack_apng_to_strip(data, p, 104, 152)
                        meta["src"] = f"assets/{rel}"
                        return meta

                    hero_futures[pool.submit(job_hero)] = (hid, gender, pose_key)

        for fut in as_completed(hero_futures):
            hid, gender, pose_key = hero_futures[fut]
            try:
                manifest["heroes"][hid][gender][pose_key] = fut.result()
            except Exception as e:
                print(f"  WARN hero {hid} {gender} {pose_key}: {e}")

        print("Heroes complete!")

        # 2. Mobs
        print(f"Fetching {len(MOBS)} authentic RO Monsters & MVPs...")
        mob_futures = {}
        mob_poses = [
            ("idle", 0, 1),
            ("walk", 1, 1),
            ("atk", 2, 1),
            ("dead", 4, 1),
        ]
        for mid in MOBS:
            manifest["mobs"][str(mid)] = {}
            for pose_key, act_idx, dir_idx in mob_poses:
                out_rel = f"mobs/{mid}_{pose_key}.png"
                out_abs = os.path.join(ASSETS_DIR, out_rel)
                params = {
                    "job": str(mid),
                    "action": str(act_idx * 8 + dir_idx),
                    "headdir": "0",
                    "canvas": "260x260+130+205",
                }
                url = f"{RAGASSETS}/image?{urllib.parse.urlencode(params)}"

                def job_mob(u=url, p=out_abs, rel=out_rel):
                    data = fetch_bytes(u)
                    meta = unpack_apng_to_strip(data, p, 130, 205)
                    meta["src"] = f"assets/{rel}"
                    return meta

                mob_futures[pool.submit(job_mob)] = (str(mid), pose_key)

        for fut in as_completed(mob_futures):
            mid, pose_key = mob_futures[fut]
            try:
                manifest["mobs"][mid][pose_key] = fut.result()
            except Exception as e:
                print(f"  WARN mob {mid} {pose_key}: {e}")

        print("Monsters complete!")

        # 3. Icons & Cards
        print("Fetching Skill, Item, Job icons and 300x400 Card Artworks...")
        static_futures = {}

        for h in HERO_CLASSES:
            jid = h["job"]
            url = f"{RAGASSETS}/icons/job/{jid}.png"
            dst = os.path.join(ASSETS_DIR, f"icons/job/{jid}.png")
            static_futures[pool.submit(fetch_bytes, url)] = dst

        for sid in SKILL_IDS:
            url = f"{RAGASSETS}/icons/skill/{sid}.png"
            dst = os.path.join(ASSETS_DIR, f"icons/skill/{sid}.png")
            static_futures[pool.submit(fetch_bytes, url)] = dst

        for iid in ITEM_IDS:
            url = f"{RAGASSETS}/icons/item/{iid}.png"
            dst = os.path.join(ASSETS_DIR, f"icons/item/{iid}.png")
            static_futures[pool.submit(fetch_bytes, url)] = dst

        for cid in CARD_IDS:
            url = f"{RAGASSETS}/illust/card/{cid}.png"
            dst = os.path.join(ASSETS_DIR, f"cards/{cid}.png")
            static_futures[pool.submit(fetch_bytes, url)] = dst

        for fut in as_completed(static_futures):
            dst = static_futures[fut]
            try:
                with open(dst, "wb") as f:
                    f.write(fut.result())
            except Exception as e:
                print(f"  WARN static {dst}: {e}")

        # 4. Maps (Ground textures + Overhead minimaps + UI cursor)
        print("Fetching Map Ground Textures, Minimaps, and RO Cursor...")
        for idx, mp in enumerate(MAPS):
            try:
                m_bytes = fetch_bytes(f"{RAGASSETS}/maps/{mp}/manifest.json")
                m_json = json.loads(m_bytes.decode("utf-8"))
                # Pick ground textures (prefer 바닥 / 초원 / 던전 / kn / cat / 필드)
                tex_items = [
                    (k, v) for k, v in m_json.get("textures", {}).items()
                    if "backside" not in k.lower() and "water" not in k.lower()
                ]
                # Sort to prioritize ground/floor textures
                def tex_priority(kv):
                    k = kv[0]
                    score = 0
                    if "바닥" in k or "초원" in k or "필드" in k or "흙" in k or "cat01" in k or "kn01" in k:
                        score -= 10
                    if "벽" in k or "기둥" in k or "나무" in k:
                        score += 5
                    return score

                tex_items.sort(key=tex_priority)
                chosen = tex_items[:4]
                saved_tex = []
                for t_i, (orig_name, rel_blob) in enumerate(chosen):
                    blob_url = urllib.parse.urljoin(f"{RAGASSETS}/maps/{mp}/", rel_blob)
                    t_bytes = fetch_bytes(blob_url)
                    t_rel = f"maps/{mp}_tex_{t_i}.png"
                    with open(os.path.join(ASSETS_DIR, t_rel), "wb") as f:
                        f.write(t_bytes)
                    saved_tex.append(f"assets/{t_rel}")

                # Overhead minimap from RateMyServer CDN -> PNG
                mm_gif = fetch_bytes(f"{RMS_CDN}/maps/{mp}.gif")
                mm_im = Image.open(io.BytesIO(mm_gif)).convert("RGBA")
                mm_rel = f"maps/{mp}_minimap.png"
                mm_im.save(os.path.join(ASSETS_DIR, mm_rel), format="PNG")

                manifest["maps"][mp] = {
                    "textures": saved_tex,
                    "minimap": f"assets/{mm_rel}",
                    "fog": m_json.get("fog"),
                }

                # Save UI cursor from first map
                if idx == 0 and "ui" in m_json:
                    ui = m_json["ui"]
                    if "grid" in ui:
                        g_url = urllib.parse.urljoin(f"{RAGASSETS}/maps/{mp}/", ui["grid"])
                        with open(os.path.join(ASSETS_DIR, "ui/grid.png"), "wb") as f:
                            f.write(fetch_bytes(g_url))
                        manifest["ui"]["grid"] = "assets/ui/grid.png"
                    if "cursor" in ui and "frames" in ui["cursor"]:
                        c_frames = []
                        for c_i, cf in enumerate(ui["cursor"]["frames"][:4]):
                            c_url = urllib.parse.urljoin(f"{RAGASSETS}/maps/{mp}/", cf)
                            c_rel = f"ui/cursor_{c_i}.png"
                            with open(os.path.join(ASSETS_DIR, c_rel), "wb") as f:
                                f.write(fetch_bytes(c_url))
                            c_frames.append(f"assets/{c_rel}")
                        manifest["ui"]["cursor"] = c_frames
            except Exception as e:
                print(f"  WARN map {mp}: {e}")

        # 5. Sound Effects (.wav)
        print("Fetching 25 authentic RO Sound Effects (.wav)...")
        sfx_futures = {}
        for key, wav_name in SOUNDS.items():
            url = f"{RAGASSETS}/effect/sound?file={urllib.parse.quote(wav_name)}"
            sfx_futures[pool.submit(fetch_bytes, url)] = key

        for fut in as_completed(sfx_futures):
            key = sfx_futures[fut]
            try:
                rel = f"sfx/{key}.wav"
                with open(os.path.join(ASSETS_DIR, rel), "wb") as f:
                    f.write(fut.result())
                manifest["sfx"][key] = f"assets/{rel}"
            except Exception as e:
                print(f"  WARN sfx {key}: {e}")

        # 6. Original SoundTeMP BGM (.mp3)
        print("Fetching Original RO SoundTeMP BGM tracks (.mp3)...")
        bgm_futures = {}
        unique_tracks = set(BGM_TRACKS.values())
        track_files = {}
        for tr in unique_tracks:
            url = f"{RAGASSETS}/bgm/{tr}"
            bgm_futures[pool.submit(fetch_bytes, url)] = tr

        for fut in as_completed(bgm_futures):
            tr = bgm_futures[fut]
            try:
                rel = f"bgm/{tr}"
                with open(os.path.join(ASSETS_DIR, rel), "wb") as f:
                    f.write(fut.result())
                track_files[tr] = f"assets/{rel}"
            except Exception as e:
                print(f"  WARN bgm {tr}: {e}")

        for map_key, tr in BGM_TRACKS.items():
            if tr in track_files:
                manifest["bgm"][map_key] = track_files[tr]

    manifest_path = os.path.join(ASSETS_DIR, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, separators=(",", ":"))
    print(f"ALL ASSETS DOWNLOADED! Manifest written to {manifest_path}")


if __name__ == "__main__":
    main()
