import os
import sys
import shutil

# Fix torchaudio.load using soundfile
import soundfile as sf
import torch
import torchaudio

def soundfile_load(filepath, out=None, normalization=True, channels_first=True, format=None):
    data, samplerate = sf.read(filepath, dtype='float32')
    tensor = torch.from_numpy(data)
    if tensor.ndim == 1:
        tensor = tensor.unsqueeze(0)
    elif channels_first and tensor.ndim == 2:
        tensor = tensor.t()
    return tensor, samplerate

torchaudio.load = soundfile_load

# Link ffmpeg
import imageio_ffmpeg
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
ffmpeg_dir = os.path.dirname(ffmpeg_exe)
standard_ffmpeg = os.path.join(ffmpeg_dir, "ffmpeg.exe")
if not os.path.exists(standard_ffmpeg):
    try:
        shutil.copyfile(ffmpeg_exe, standard_ffmpeg)
    except Exception:
        pass
os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")

from f5_tts.api import F5TTS

def run_clone_test():
    ref_audio = "data/voice_samples/individual_clips/01_Dora.wav"
    output_audio = "data/cloned_voice_test.wav"
    
    # 1. Custom reference text (bypass Whisper on singing clip)
    ref_text = "Dora Dora"
    
    # 2. Single sentence (avoids generating 4 separate sequential batches)
    test_sentence = "Vanakkam, Chennai Mobility AI-kku ungalai anbudan varaverkirom."
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n[INFO] Running on Device: {device.upper()}")
    if device == "cpu":
        print("[TIP] You have an NVIDIA RTX 3050 GPU, but PyTorch CPU-only build is currently installed.")
        print("[TIP] Installing PyTorch with CUDA will make this 50x faster (under 3 seconds)!\n")
    
    print(f"Loading F5-TTS model using reference audio: {ref_audio}...")
    f5tts = F5TTS(device=device)
    
    print(f"Generating cloned voice speech for: '{test_sentence}'...")
    # nfe_step=16 halves computation time with virtually identical quality
    wav, sr, _ = f5tts.infer(
        ref_file=ref_audio,
        ref_text=ref_text,
        gen_text=test_sentence,
        file_wave=output_audio,
        nfe_step=16,
        seed=42,
    )
    
    if os.path.exists(output_audio):
        print(f"\n=======================================================")
        print(f"SUCCESS! Cloned speech generated successfully!")
        print(f"File saved to: {os.path.abspath(output_audio)}")
        print(f"Sample Rate: {sr} Hz")
        print(f"=======================================================\n")
    elif wav is not None:
        sf.write(output_audio, wav, sr)
        print(f"SUCCESS! Cloned speech saved to: {os.path.abspath(output_audio)}")
    else:
        print("ERROR: Output could not be generated.")

if __name__ == "__main__":
    run_clone_test()
