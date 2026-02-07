# What's changed?
earlier the files recieved from frontend was being saved at project root dir with a fixed filename, so if we send multiple request at same time it would cause error. fixed it by creating a temp directory with a uuid for each requests and saving its data in that folder which cleans up automatically when process ends. also instead of passing 4 args to each executable. now we send only one which is the path of the temp dir for that request. and we can get files from there as they have predefined file name. For eg..

tmp/req_1234/ \
employees.csv \
vehichles.csv \
metadata.csv \
matrix.txt 

- Also now the output for each request created by different algos are being saved in the temp dir for that request only. i have made the required changes to ALNS, CRDP, and HDARP. instead of saving the output to their own directory they create and save them in temp directory. same goes for log files

- the other 2 algos still need work, so they remain.

- go through the changes and check if some work is needed. *make sure to remove the warnings in the algo which are raised when the argc<4, and adjust other stuff like that*




# Steps to build and run the server:
- first clone the repo
- run make command in the repo directory
- it may show error regarding asio.h, it is because we are passing flags to use standalone asio source instead of boost lib
- fix it by running: sudo apt install libasio-dev
- after the build is completed successfully
- run the server_app executable
- the API will be live on port 5555 on your local network
# Testing the API
- we gonna test it with curl, we can send request via any other method too
- make sure the 3 files ( employees.csv, vehicles.csv, metadata.csv ) are present in your working directory
- NOTE: our api is handling the POST request at localhost:5555/upload
- run the curl command
- curl -X POST http://localhost:5555/upload   -F "employees=@employees.csv"   -F "vehicles=@vehicles.csv"   -F "metadata=@metadata.csv"
- u should get the response (if not then leave it)
- the logs will be printed in the server terminal
- respective logs for each algo will be saved in their respective directories

# NOTE: this is not the final API, there are some issues which can be fixed
