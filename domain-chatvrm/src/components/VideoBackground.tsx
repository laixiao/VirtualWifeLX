import React, { CSSProperties } from 'react';

const VideoBackground = () => {
    const videoStyle: CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        minWidth: '100%',
        minHeight: '100%',
        width: 'auto',
        height: 'auto',
        objectFit: 'cover',
        zIndex: -100 // 确保视频在所有内容之下
    };

    return (
        <video style={videoStyle} autoPlay loop muted>
            <source src="http://localhost:3000/bg/3异画-抖抖素材屋.mp4" type="video/mp4" />
            Your browser does not support the video tag.
        </video>
    );
}

export default VideoBackground;
