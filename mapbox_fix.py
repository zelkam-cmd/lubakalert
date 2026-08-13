import urllib.request, json

TOKEN = "YOUR_MAPBOX_KEY_HERE" //gawa lang ng api key sa mapbox

def get_mapbox_route(waypoints):
    coords = ";".join([f"{lon},{lat}" for lon, lat in waypoints])
    url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{coords}?access_token={TOKEN}&geometries=geojson&overview=full"
    
    req = urllib.request.Request(url)
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode('utf-8'))
    
    geojson_coords = data['routes'][0]['geometry']['coordinates']
    return [[lat, lon] for lon, lat in geojson_coords]

# MacArthur Route: Just Start -> 1 Midpoint -> End to prevent U-turn loops!
wp_mc = [
    (120.81620, 14.85840), # BulSU
    (120.88780, 14.81840), # Middle of MacArthur (Balagtas)
    (120.95750, 14.73500)  # Meycauayan Center
]

# NLEX Route: Just Start -> 1 Midpoint -> End
wp_nlex = [
    (120.81620, 14.85840), # BulSU
    (120.91500, 14.79300), # Middle of NLEX
    (120.95750, 14.73500)  # Meycauayan Center
]

print("Fetching flawless MacArthur from Mapbox...")
mc_coords = get_mapbox_route(wp_mc)

print("Fetching flawless NLEX from Mapbox...")
nlex_coords = get_mapbox_route(wp_nlex)

content = f'window.LubakRoadData = {{\n  macarthur: {json.dumps(mc_coords)},\n  nlex: {json.dumps(nlex_coords)}\n}};\n'
with open('js/road_data.js', 'w') as f:
    f.write(content)

print(f"Success! MacArthur: {len(mc_coords)} points, NLEX: {len(nlex_coords)} points.")
