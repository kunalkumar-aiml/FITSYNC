import json, sys, os
P = os.path.join(os.path.dirname(__file__), "charts.json")
def load():
    return json.load(open(P)) if os.path.exists(P) else {"charts": [], "unavailable": []}
def save(d): json.dump(d, open(P, "w"), indent=1)
