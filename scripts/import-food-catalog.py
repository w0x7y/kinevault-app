"""Build the app's food catalog from an official USDA FNDDS download."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import zipfile

SOURCE_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip"
NUTRIENTS = {"calories": (1008, "kcal"), "carbs": (1005, "g"), "protein": (1003, "g"), "fat": (1004, "g")}
DETAILED_NUTRIENTS = {
    "saturatedFat": (1258, "g"), "transFat": (1257, "g"), "fiber": (1079, "g"),
    "totalSugars": (2000, "g"), "sodium": (1093, "mg"), "cholesterol": (1253, "mg"),
    "potassium": (1092, "mg"), "calcium": (1087, "mg"), "iron": (1089, "mg"),
    "vitaminD": (1114, "mcg"), "caffeine": (1057, "mg"), "alcohol": (1018, "g"),
}


def valid_number(value, positive=False):
    return (type(value) in (int, float) and math.isfinite(value)
            and (value > 0 if positive else value >= 0))


def build_catalog(document, checksum):
    records = document.get("SurveyFoods")
    if not isinstance(records, list) or not records:
        raise ValueError("Expected a nonempty USDA SurveyFoods array")
    foods = []
    seen = set()
    for record in records:
        fdc_id = record.get("fdcId")
        name = record.get("description")
        if type(fdc_id) is not int or fdc_id <= 0 or not isinstance(name, str) or not name.strip():
            raise ValueError("Invalid USDA food identifier or description")
        if fdc_id in seen:
            raise ValueError(f"Duplicate USDA food ID: {fdc_id}")
        seen.add(fdc_id)
        if record.get("dataType") != "Survey (FNDDS)":
            raise ValueError(f"Unexpected data type for USDA food {fdc_id}")
        if record.get("publicationDate") != "10/31/2024":
            raise ValueError(f"Unexpected USDA release for food {fdc_id}; expected October 31, 2024")
        nutrients = {item["nutrient"]["id"]: item for item in record.get("foodNutrients", [])}
        nutrition = {}
        for key, (nutrient_id, unit) in NUTRIENTS.items():
            nutrient = nutrients.get(nutrient_id, {})
            amount = nutrient.get("amount")
            if nutrient.get("nutrient", {}).get("unitName", "").lower() == unit and valid_number(amount):
                nutrition[key] = amount
        if len(nutrition) != len(NUTRIENTS):
            continue
        details = {}
        for key, (nutrient_id, unit) in DETAILED_NUTRIENTS.items():
            nutrient = nutrients.get(nutrient_id, {})
            source_unit = nutrient.get("nutrient", {}).get("unitName", "").lower()
            if source_unit in ("µg", "μg", "ug"):
                source_unit = "mcg"
            amount = nutrient.get("amount")
            details[key] = amount if source_unit == unit and valid_number(amount) else None
        portions = []
        seen_portions = set()
        for portion in sorted(record.get("foodPortions", []), key=lambda p: p.get("sequenceNumber", 0)):
            label = portion.get("portionDescription", "").strip()
            grams = portion.get("gramWeight")
            if not label or label.lower() == "quantity not specified" or not valid_number(grams, positive=True):
                continue
            pair = (label, grams)
            if pair not in seen_portions:
                portions.append({"label": label, "grams": grams})
                seen_portions.add(pair)
        foods.append({
            "fdcId": fdc_id, "name": name.strip(),
            "category": record.get("wweiaFoodCategory", {}).get("wweiaFoodCategoryDescription", ""),
            "per100g": nutrition, "details": details, "portions": portions,
        })
    if not foods:
        raise ValueError("No foods with complete calorie and macro data")
    foods.sort(key=lambda food: food["fdcId"])
    return {
        "schemaVersion": 1,
        "source": {
            "name": "USDA FoodData Central", "dataset": "FNDDS 2021-2023",
            "releaseDate": "2024-10-31", "license": "CC0-1.0",
            "url": "https://fdc.nal.usda.gov/download-datasets/", "downloadUrl": SOURCE_URL,
            "inputSha256": checksum, "recordCount": len(foods), "excludedCount": len(records) - len(foods),
        },
        "foods": foods,
    }


def read_download(path):
    raw = path.read_bytes()
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            names = [name for name in archive.namelist() if name.endswith(".json")]
            if len(names) != 1:
                raise ValueError("Expected one USDA JSON document in the archive")
            document = json.loads(archive.read(names[0]))
    else:
        document = json.loads(raw)
    return document, hashlib.sha256(raw).hexdigest()

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("input", type=Path)
parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "assets/food/usda-fndds.json")
args = parser.parse_args()
try:
    document, checksum = read_download(args.input)
    catalog = build_catalog(document, checksum)
except (ValueError, KeyError, TypeError, OSError, zipfile.BadZipFile) as error:
    parser.exit(1, f"Food import failed: {error}\n")
args.output.parent.mkdir(parents=True, exist_ok=True)
# One record per line keeps generated data reviewable without excessive whitespace.
content = '{\n"schemaVersion": 1,\n"source": ' + json.dumps(catalog["source"], ensure_ascii=False)
content += ',\n"foods": [\n' + ',\n'.join(json.dumps(food, ensure_ascii=False, separators=(",", ":")) for food in catalog["foods"]) + '\n]\n}\n'
temporary = args.output.with_suffix(".tmp")
temporary.write_text(content, encoding="utf-8")
temporary.replace(args.output)
print(f"Imported {len(catalog['foods']):,} foods; excluded {catalog['source']['excludedCount']} incomplete records. {args.output}")
