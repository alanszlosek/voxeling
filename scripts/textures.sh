#!/bin/bash

echo "Downloading textures into third-party"
TS=textures-20220405
wget https://alanszlosek.com/voxeling/${TS}.zip -O third-party/textures.zip
echo "Extracting textures into www/textures"
cd www/textures
unzip ../../third-party/textures.zip
# rename textures-YYYYMMDD folder to voxels
mv ${TS} voxels

cd ../../scripts
echo "Setting up python3 virtual environment for generating texture atlases"
python3 -m venv ./venv
source venv/bin/activate
pip3 install pillow
echo "Generating texture atlases"
python3 texture-atlases.py

cd ..

echo "Done with textures.sh."
