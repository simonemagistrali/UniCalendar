import random, statistics as st
random.seed(42)
T = random.triangular
N = 100000
rows = []
keys = ["create","plan","decide","recover","travel","focus","overhead","total_planner","total_nonplanner","hours_year_planner","hours_year_nonplanner","setup_once"]
out = {k: [] for k in keys}
params = {}
for _ in range(N):
    n_tasks = T(8,25,15)
    create = n_tasks * T(0.3,1.0,0.5) * 0.90            # 10% still manual edits
    weekly = T(10,45,25); days = T(3,6,5); daily = days * T(2,8,4)
    plan = (weekly + daily) - T(2,10,5)                  # minus residual app review
    decide = T(2,5,3) * T(5,7,6) * T(0.5,2,1.0) * 0.75   # 25% decisions remain
    recover = T(1,4,2) * T(3,10,5) * T(0.5,0.85,0.7)
    travel = T(1,6,3) * T(0.5,2,1.0) * 0.95
    focus = T(5,30,15) * T(0.25,1.5,0.5)
    overhead = T(1,8,3)
    gross = create + plan + decide + recover + travel + focus
    planner_net = gross - overhead
    # non-planner baseline spends ~0 on planning: only decisions/travel/focus are "baseline"
    nonplanner_net = (decide*0.3 + focus*0.3) - T(2,10,5) - overhead
    weeks = T(26,34,30)
    setup = 2*(T(20,30,24) * T(0.5,1.5,1.0) - T(2,10,4))
    for k,v in zip(keys,[create,plan,decide,recover,travel,focus,overhead,planner_net,nonplanner_net,
                         (planner_net*weeks+setup)/60,(nonplanner_net*weeks+setup)/60,setup]):
        out[k].append(v)

def q(x,p):
    s = sorted(x); return s[int(p*(len(s)-1))]
print("min/week  mean  median  P5  P95")
for k in keys:
    x = out[k]
    print(f"{k:24s} {st.mean(x):8.1f} {st.median(x):8.1f} {q(x,.05):8.1f} {q(x,.95):8.1f}")
print("P(planner net>0)", sum(v>0 for v in out['total_planner'])/N)
print("P(nonplanner net>0)", sum(v>0 for v in out['total_nonplanner'])/N)
# share of variance by component (correlation with total)
import math
def corr(a,b):
    ma,mb=st.mean(a),st.mean(b)
    return sum((x-ma)*(y-mb) for x,y in zip(a,b))/math.sqrt(sum((x-ma)**2 for x in a)*sum((y-mb)**2 for y in b))
print("corr with total (planner):")
for k in ["create","plan","decide","recover","travel","focus","overhead"]:
    print(f"  {k:10s} {corr(out[k],out['total_planner']):.2f}")
