from io import BytesIO
import subprocess

from django.shortcuts import render
import os
import json
import logging
from django.http import FileResponse
from .translation import translationClient
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .tts import single_tts_driver
from django.http import HttpResponse, StreamingHttpResponse

logger = logging.getLogger(__name__)

# sudo apt-get install ffmpeg
def get_audio_duration(file_path):
    try:
        # 使用FFmpeg获取音频时长
        result = subprocess.run(['ffprobe', '-i', file_path, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # 解析结果
        duration = float(result.stdout)

        return duration
    except Exception as e:
        print(f"获取音频时长错误 Error getting audio duration: {e}")
        return None
    
@api_view(["POST"])
def generate(request):
    """
    Generate audio from text.
    """
    try:
        data = json.loads(request.body.decode("utf-8"))
        text = data["text"]
        voice_id = data["voice_id"]
        type = data["type"]

        file_name = single_tts_driver.synthesis(type=type, text=text, voice_id=voice_id)
        file_path = os.path.join("tmp", file_name)

        duration = get_audio_duration(file_path)
        if duration is not None:
            print(f"音频时长：{duration} 秒")
        else:
            print("无法获取音频时长")
            
        audio_file = BytesIO()
        with open(file_path, "rb") as file:
            audio_file.write(file.read())

        delete_file(file_path)
        logger.debug(f"delete file :{file_path}")

        audio_file.seek(0)

        # Create the response object.
        response = HttpResponse(content_type="audio/mpeg")
        response["Content-Disposition"] = f'attachment; filename="{file_name}"'
        response.write(audio_file.getvalue())
        return response
    except Exception as e:
        logger.error(f"generate_audio error: {e}")
        return HttpResponse(status=500, content="Failed to generate audio.")


def delete_file(file_path):
    os.remove(file_path)


@api_view(["POST"])
def get_voices(request):
    data = json.loads(request.body.decode("utf-8"))
    type = data["type"]
    return Response(
        {"response": single_tts_driver.get_voices(type=type), "code": "200"}
    )


@api_view(["POST"])
def translation(request):
    """
    translation
    """
    try:
        data = json.loads(request.body.decode("utf-8"))
        text = data["text"]
        target_language = data["target_language"]
        target_result = translationClient.translation(
            text=text, target_language=target_language
        )
        return Response({"response": target_result, "code": "200"})
    except Exception as e:
        logger.error(f"translation error: {e}")
        return HttpResponse(status=500, content="Failed to translation error.")
