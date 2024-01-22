from sys import argv
import json
data = open(argv[1])
print(json.dumps(eval(data.read())))
data.close()