#!/bin/bash

echo "Copying example configuration so you can customize later"
cp config-client-example.mjs config-client.mjs
cp config-server-example.mjs config-server.mjs


echo "Downloading textures into third-party"
TS=textures-20220405
wget https://alanszlosek.com/voxeling/${TS}.zip -O third-party/textures.zip
echo "Extracing textures into www/textures"
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

echo "Installing node dependencies"
npm install


echo "Done with setup.sh. Follow the rest of the instructions in INSTALL.md"
