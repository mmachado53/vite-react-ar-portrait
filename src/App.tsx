import './App.css'
import ImageTracker from './ImageTracker'

function App() {

  return (
    <>
     
     <ImageTracker imageUrl="/targets.mind" imageUrls={['/tracking_img.jpg', '/img2.jpg', '/img3.jpg','/img4.jpg']} />
    </>
  )
}

export default App
