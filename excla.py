import json
from bson import json_util
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://thedanceandmovementworkshop_db_user:EcXmJj43xmkZxaFM@cluster0.9hjo2oh.mongodb.net/the_dance_and_movement_workshop?appName=Cluster0"


def fetch_collection_data(uri, db_name, collection_name):
    with MongoClient(uri) as client:
        return list(client[db_name][collection_name].find())


def write_json_file(data, output_filepath):
    serialized_data = json_util.dumps(data, indent=2)
    with open(output_filepath, "w", encoding="utf-8") as file:
        file.write(serialized_data)


def export_classes_to_json(
    uri=MONGO_URI,
    db_name="the_dance_and_movement_workshop",
    collection_name="classes",
    output_filepath="classes_export.json",
):
    data = fetch_collection_data(uri, db_name, collection_name)
    write_json_file(data, output_filepath)
    return len(data)


if __name__ == "__main__":
    count = export_classes_to_json()
    print(f"Successfully exported {count} documents to classes_export.json")