"""Institutional-role agents for the Murshid policy simulation.

Each agent has a mandate (what it is responsible for), a set of KB sources it is allowed to
reason from (its legal basis), and a rule table for the deterministic engine. In LLM mode
the same mandate, sources and retrieved chunks go to a low-cost model, which must answer in
a fixed JSON schema and may only cite chunk ids it was given (checked after the call).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from .kb import Hit, KnowledgeBase
from .llm import LLM

UAE_CORE = ["uae-pdpl-2021", "uae-child-digital-safety-2025", "uae-cabinet-children-social-media"]
UAE_AI = ["uae-national-ai-strategy-2031", "uae-ai-charter-2024", "uae-ai-ethics-guidelines-2022", "uae-generative-ai-guide-2023", "dubai-ai-ethics-2019"]
KHDA = ["khda-exam-contingency-2026", "khda-distance-learning-2026", "khda-teacher-recruitment-guide", "khda-future-ready-schools"]
MOE = ["moe-ai-literacy-framework"]
CYBER = ["uae-cybersecurity-strategy-2019"]
GLOBAL = ["unesco-genai-education-2023", "unicef-ai-children-v3-2025", "oecd-ai-recommendation", "eu-ai-act-2024", "us-coppa-rule", "uk-age-appropriate-design-code"]


@dataclass
class Rule:
    tag: str
    role: str            # lead | support | inform
    action: str
    query: str
    evidence: list[str]  # words the cited chunk must contain for the citation to count as supporting
    notify: list[str] = field(default_factory=list)
    deadline: str = ""
    hint: str = ""       # preferred section (e.g. "(9)" for PDPL Article 9)


@dataclass
class AgentSpec:
    id: str
    name: str
    institution: str
    mandate: str
    sources: list[str]
    rules: list[Rule]


AGENTS: dict[str, AgentSpec] = {}


def _add(a: AgentSpec):
    AGENTS[a.id] = a


_add(AgentSpec(
    "murshid_operator", "Murshid tutor agent (operator)", "Murshid platform: data controller for student accounts, processor for schools, a 'digital platform' under Decree-Law 26/2025",
    "Run the student-facing AI tutor/planner safely; contain incidents; meet controller/processor and digital-platform duties; keep students learning.",
    UAE_CORE + UAE_AI + MOE + CYBER,
    [
        Rule("breach", "lead", "Contain the leak (revoke exposed links/tokens, rotate keys, preserve logs) and notify the UAE Data Office with the nature of the breach, DPO details, likely effects and corrective measures; then inform affected students and guardians.",
             "controller notify the Bureau breach description nature causes approximate number Data Protection Officer corrective measures", ["breach"], ["data_office", "school_khda"],
             "PDPL Art. 9: 'within the period ... set by the Executive Regulations' (no number of hours in the law itself)", hint="(9)"),
        Rule("minor_data", "lead", "Treat the records as children's data: restrict access to the minimum staff needed and stop any non-essential processing of them.",
             "personal data of Children restricting access to authorized persons minimum extent necessary", ["child"], ["child_safety"], hint="(7)"),
        Rule("consent_unverified", "lead", "Suspend processing for the affected accounts until consent is verified; re-run guardian verification; keep proof of each consent.",
             "Controller shall be able to prove the consent of the Data Subject withdraw", ["consent"], ["school_khda", "data_office"], hint="(6)"),
        Rule("harmful_content", "lead", "Remove the content, block the prompt pattern, review the safety filter, and report the incident through the platform's reporting channel.",
             "digital platforms obligations harmful content children reporting mechanisms blocking", ["harmful"], ["child_safety", "school_khda"], hint="(15)"),
        Rule("model_outage", "lead", "Fail over to the deterministic rule engine and cached plans so students keep access to their schedules and notes; tell schools what is degraded.",
             "measures ensure timely retrieval of and access to Personal Data in case of any actual or technical failure", ["failure"], ["school_khda"], hint="(20)"),
        Rule("cross_border", "support", "Map which model providers process data outside the UAE and on what legal basis; prefer providers with UAE/adequate jurisdiction or contractual safeguards.",
             "transfer Personal Data outside the State legislation protection contract", ["outside the State"], ["data_office"], hint="(22)"),
        Rule("exam", "support", "Keep AI help inside the school's academic-integrity rules during exams (no answer generation for assessed work).",
             "academic integrity authentic learning assessment AI tools", ["integrity"], ["school_khda"]),
    ]))

_add(AgentSpec(
    "school_khda", "School and KHDA regulator agent", "The private school (Our Own High School-type Dubai private school) and the Knowledge and Human Development Authority (KHDA), regulator of Dubai private schools",
    "Safeguard students; keep teaching and assessment running; oversee how schools use third-party EdTech; communicate with parents.",
    KHDA + MOE + ["uae-pdpl-2021", "uae-child-digital-safety-2025", "dubai-ai-ethics-2019"],
    [
        Rule("breach", "support", "Activate the school's safeguarding response, tell affected families what happened in plain language, and record the incident with the provider.",
             "safeguarding students wellbeing online safety parents communication", ["safeguard"], ["murshid_operator"]),
        Rule("harmful_content", "lead", "Treat as a safeguarding incident: check on the student, involve the counsellor, inform the parent, and review whether the tool stays approved.",
             "students wellbeing safeguarding online harmful counsellor", ["safeguard"], ["murshid_operator", "child_safety"]),
        Rule("consent_unverified", "support", "Pause the school-connector data feed for students whose guardian consent is not verified; contact those families.",
             "parents consent student data school responsibilities", ["parent"], ["murshid_operator"]),
        Rule("model_outage", "support", "Switch affected classes to the school's non-AI contingency (teacher-led revision, printed plans) and tell parents.",
             "contingency continuity learning communication schools parents", ["contingen"], ["moe"]),
        Rule("exam", "lead", "Apply the examination contingency arrangements and make sure no student is disadvantaged by the tool failing.",
             "examination contingency schools students alternative assessment evidence", ["exam"], ["moe"]),
        Rule("ai_use", "support", "Teachers keep human judgement on student matters; AI output is advisory.",
             "use technology including AI legally ethically transparently not replace human judgment student", ["AI"], []),
    ]))

_add(AgentSpec(
    "data_office", "Data-protection authority agent", "UAE Data Office (the 'Bureau' under Federal Decree-Law 45/2021, PDPL)",
    "Supervise personal-data processing; receive breach notifications and complaints; verify security measures; impose administrative penalties.",
    ["uae-pdpl-2021"] + CYBER + ["uae-ai-ethics-guidelines-2022"],
    [
        Rule("breach", "lead", "Open a breach file: verify the reasons for the breach and the adequacy of security measures; decide on administrative penalties if a violation is proven.",
             "Bureau shall verify the reasons for the violation integrity of the security measures administrative penalties", ["Bureau"], ["murshid_operator"], hint="(9)"),
        Rule("consent_unverified", "lead", "Ask the controller to prove consent for each affected student; processing without a valid basis must stop.",
             "prohibited to process Personal Data without the consent of its owner cases excluded", ["consent"], ["murshid_operator"], hint="(4)"),
        Rule("cross_border", "lead", "Check that transfers to model providers abroad meet Art. 22/23 conditions.",
             "Personal Data may be transferred to outside of the State cases approved by the Bureau", ["outside"], ["murshid_operator"], hint="(22)"),
        Rule("minor_data", "support", "Require a data-protection impact assessment, given new technology and profiling of students.",
             "assessment of the impact protection of Personal Data modern technologies high risk profiling", ["impact"], ["murshid_operator"], hint="21"),
        Rule("complaint", "lead", "Receive and examine the complaint in coordination with controller and processor.",
             "Data Subject right to submit complaints to the Bureau", ["complaint"], [], hint="(24)"),
    ]))

_add(AgentSpec(
    "moe", "Ministry of Education agent", "UAE Ministry of Education (national curriculum incl. the National AI Literacy Curriculum Framework K-12)",
    "Set national curriculum and AI-in-education expectations (approved tools, age restrictions, academic integrity) for public schools and private schools on the MoE curriculum; align with the National AI Strategy 2031.",
    MOE + UAE_AI,
    [
        Rule("harmful_content", "support", "Check the tool against the Guide's approved-tool and age-restriction rules; issue guidance to schools if the issue is systemic.",
             "Guide defines approved tools permissible classroom use age restrictions", ["age restriction"], ["school_khda"]),
        Rule("exam", "support", "Restate academic-integrity expectations for AI use around assessment.",
             "academic integrity authentic learning expectations AI assessment", ["integrity"], ["school_khda"]),
        Rule("model_outage", "inform", "Record the outage as a resilience lesson for national AI-in-education rollout.",
             "AI infrastructure resilience education strategy", ["AI"], []),
        Rule("ai_use", "support", "Apply the UAE AI Charter principles (safety, human oversight, privacy).",
             "Charter safety human oversight privacy principles", ["safety"], []),
    ]))

_add(AgentSpec(
    "child_safety", "Child digital safety agent", "Child Digital Safety Council (chaired by the Minister of Family) with TDRA as the 'Authority' under Federal Decree-Law 26/2025",
    "Protect children from digital risks and harmful content; classify platforms; enforce age verification and child-data rules.",
    ["uae-child-digital-safety-2025", "uae-cabinet-children-social-media"] + CYBER,
    [
        Rule("harmful_content", "lead", "Log the report of harmful content to a child, require the platform's corrective action, and check its child-protection controls.",
             "reporting harmful content for children digital platforms obligations", ["harmful"], ["murshid_operator"], hint="(15)"),
        Rule("minor_data", "lead", "Check the platform against the child-data prohibitions (no use for commercial purposes or ads; minimum access) and whether an educational-platform exemption applies.",
             "platforms used for educational or health purposes exempted prohibition Cabinet Resolution", ["educational"], ["murshid_operator"], hint="(7)"),
        Rule("consent_unverified", "lead", "For any under-13 user: require explicit, documented, verifiable parental consent and an easy withdrawal route.",
             "parental consent explicit documented verifiable withdrawing", ["parental consent"], ["murshid_operator"], hint="(7)"),
        Rule("age_verification", "lead", "Require age verification proportionate to the platform's risk class.",
             "age-verification mechanisms classification of digital platforms risk", ["age"], ["murshid_operator"], hint="(8)"),
    ]))

ADVISER_SOURCES = UAE_CORE + UAE_AI + KHDA + MOE + CYBER + GLOBAL


# --------------------------------------------------------------------------- engines
SYSTEM_TMPL = """You are the {name} in a policy simulation about Murshid, an AI education agent for UAE school students.
Institution: {institution}
Mandate: {mandate}
Rules: act only within your mandate; base every legal or policy claim on the numbered KB excerpts given to you and cite their ids exactly (e.g. "uae-pdpl-2021#0014"); never invent article numbers, deadlines or penalties; say what you do not know. Information may be incomplete and other institutions may know things you do not.
Answer with ONE JSON object and nothing else:
{{"situation": str, "rationale": str (3-5 sentences: your reasoning summary), "role": "lead"|"support"|"inform",
 "actions": [{{"action": str, "citations": [chunk ids]}}], "deadlines": [str], "uncertainties": [str],
 "messages": [{{"to": one of {peers}, "type": "inform"|"request"|"directive", "content": str}}], "confidence": number 0-1}}"""


def retrieve_for(kb: KnowledgeBase, spec: AgentSpec, text: str, tags: list[str], k: int = 6) -> list[Hit]:
    seen, hits = set(), []
    for r in [r for r in spec.rules if r.tag in tags][:3]:
        for h in kb.search(r.query, k=2, sources=spec.sources, per_source=2):
            if h.id not in seen:
                seen.add(h.id); hits.append(h)
    for h in kb.search(text, k=k, sources=spec.sources, per_source=2):
        if h.id not in seen and len(hits) < k + 3:
            seen.add(h.id); hits.append(h)
    return hits


def offline_turn(kb: KnowledgeBase, spec: AgentSpec, text: str, tags: list[str], handled: dict | None = None) -> dict:
    """Deterministic rules + retrieval engine (zero cost, reproducible)."""
    actions, deadlines, messages, roles, cites_all = [], [], [], [], []
    done = handled.setdefault(spec.id, set()) if handled is not None else set()
    for r in spec.rules:
        if r.tag not in tags:
            continue
        if r.tag in done:
            actions.append({"action": f"Follow-up on '{r.tag}': already acting ({r.role}); new information added to the case file, no duplicate notifications sent.",
                            "rule_tag": r.tag, "role": r.role, "citations": [], "citation_check": "not_needed (follow-up)"})
            roles.append(r.role)
            continue
        done.add(r.tag)
        hits = kb.search(r.query, k=8, sources=spec.sources, per_source=4)
        support = [h for h in hits if any(e.lower() in h.text.lower() for e in r.evidence)]
        hinted = [h for h in support if r.hint and r.hint in (h.meta.get("section") or "")]
        best = (hinted or support or hits)[:1]
        actions.append({"action": r.action, "rule_tag": r.tag, "role": r.role, "citations": [h.id for h in best],
                        "citation_check": "supported" if support else "weak"})
        cites_all += best
        roles.append(r.role)
        if r.deadline:
            deadlines.append(r.deadline)
        for to in r.notify:
            messages.append({"to": to, "type": "inform" if r.role != "lead" else "request", "tags": [r.tag],
                             "content": f"[{r.tag}] {spec.name} acting as {r.role}: {r.action[:160]}"})
    role = "lead" if "lead" in roles else ("support" if "support" in roles else "inform")
    return {
        "situation": text[:400],
        "rationale": (f"Matched tags {sorted(set(tags) & {r.tag for r in spec.rules})} to my mandate; "
                      f"actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.")
        if actions else "Nothing in this information falls within my mandate; noted for awareness.",
        "role": role if actions else "inform",
        "actions": actions,
        "deadlines": deadlines,
        "uncertainties": [] if actions else ["No mandate-relevant trigger in the information received."],
        "messages": messages,
        "confidence": 0.6 if actions else 0.3,
        "_hits": cites_all,
    }


def llm_turn(llm: LLM, kb: KnowledgeBase, spec: AgentSpec, text: str, tags: list[str]) -> tuple[dict | None, dict, list[Hit]]:
    hits = retrieve_for(kb, spec, text, tags)
    excerpts = "\n\n".join(f"[{h.id}] {h.meta['title']} | {h.meta.get('section','')} | p.{h.meta.get('page_start')}\n{h.text[:900]}" for h in hits)
    peers = [a for a in AGENTS if a != spec.id]
    system = SYSTEM_TMPL.format(name=spec.name, institution=spec.institution, mandate=spec.mandate, peers=json.dumps(peers))
    user = f"NEW INFORMATION YOU RECEIVED:\n{text}\n\nKB EXCERPTS YOU MAY CITE:\n{excerpts}"
    out, info = llm.chat_json(system, user, max_tokens=2500, reserve=1)
    if out is not None:
        for key in ("deadlines", "uncertainties", "actions", "messages"):
            v = out.get(key)
            if isinstance(v, (str, dict)):
                out[key] = [v]
            elif not isinstance(v, list):
                out[key] = []
        out["actions"] = [a if isinstance(a, dict) else {"action": str(a), "citations": []} for a in out["actions"]]
        # deadline check: a number of hours/days must appear in the excerpts the agent was given
        corpus = " ".join(h.text for h in hits).lower()
        checked = []
        for d in out["deadlines"]:
            d = str(d)
            nums = re.findall(r"(\d+)\s*(?:h\b|hours?|days?|business days?|working days?)", d.lower())
            bad = [n for n in nums if not re.search(rf"\b{n}\b|\({n}\)", corpus)]
            checked.append(d + (f"  [UNSUPPORTED: '{', '.join(bad)}' not in any cited source]" if bad else ""))
        out["deadlines"] = checked
        out["unsupported_deadlines"] = sum("[UNSUPPORTED" in d for d in checked)
        allowed = {h.id for h in hits}
        for a in out.get("actions", []) or []:
            if isinstance(a, dict):
                c = [x for x in a.get("citations", []) or [] if isinstance(x, str)]
                a["citations"] = [x for x in c if x in allowed]
                a["citation_check"] = "supported" if a["citations"] else ("rejected_unknown_ids" if c else "uncited")
        out["messages"] = [m for m in out.get("messages", []) or [] if isinstance(m, dict) and m.get("to") in AGENTS]
    info["prompt_chars"] = len(system) + len(user)
    return out, info, hits
