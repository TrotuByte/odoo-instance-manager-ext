from sys import argv, stderr
from json import dumps
if len(argv) != 2:
    stderr.write("You must pass only the absolute path of the manifest file")
    exit(1)
data = open(argv[1])
print(dumps(eval(data.read())))
data.close()