from video_voice_separate.cli import build_parser


def test_cli_run_parser() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "run",
            "--input",
            "sample.mp4",
            "--mode",
            "music",
            "--output-format",
            "mp3",
            "--quality",
            "high",
        ]
    )
    assert args.command == "run"
    assert args.input == "sample.mp4"
    assert args.mode == "music"
    assert args.output_format == "mp3"
    assert args.quality == "high"


def test_cli_transcribe_parser() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "transcribe",
            "--input",
            "voice.wav",
            "--output-dir",
            "output-transcribe",
            "--language",
            "zh",
            "--asr-model",
            "small",
            "--no-srt",
        ]
    )
    assert args.command == "transcribe"
    assert args.input == "voice.wav"
    assert args.output_dir == "output-transcribe"
    assert args.language == "zh"
    assert args.asr_model == "small"
    assert args.no_srt is True
