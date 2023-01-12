import React, { useState } from 'react'
import { toast } from 'react-toastify';
import Spinner from "../components/Spinner";
import { getAuth } from 'firebase/auth'
import { v4 as uuidv4 } from 'uuid'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useNavigate } from 'react-router';

export default function CreateListing() {
    const navigate = useNavigate()
    const auth = getAuth()
    const [geolocationEnabled, setGeolocationEnabled] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        type: 'sale',
        name: '',
        bedrooms: 1,
        bathrooms: 1,
        parking: false,
        furnished: false,
        address: '',
        description: '',
        offer: false,
        regularPrice: 0,
        discountedPrice: 0,
        latitude: 0,
        longitude: 0,
        images: [],
    })
    const { type, name, bedrooms, bathrooms, parking, furnished, address, description, offer, regularPrice, discountedPrice, images, latitude, longitude } = formData


  function onChange(e) {
    let boolean = null;
    if (e.target.value === "true") {
      boolean = true;
    }
    if (e.target.value === "false") {
      boolean = false;
    }
    // Files
    if (e.target.files) {
      setFormData((prevState) => ({
        ...prevState,
        images: e.target.files,
      }));
    }
    // Text/Boolean/Number
    if (!e.target.files) {
      setFormData((prevState) => ({
        ...prevState,
        [e.target.id]: boolean ?? e.target.value,
      }));
    }
  }
  
  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    if(+discountedPrice >= +regularPrice) {
        setLoading(false)
        toast.error('Regular price should be larger than discounted price')
    }
    if(images.length > 6) {
        setLoading(false)
        toast.error('Maximum 6 images are allowed')
    }
    let geolocation = {}
    let location = {}
    if (geolocationEnabled) {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?${address}&key=${process.env.REACT_APP_GEOCODE_API_KEY}`
        )
        const data = await response.json()
        console.log(data);
        geolocation.lat = data.results[0]?.geometry.location.lat ?? 0
        geolocation.lng = data.results[0]?.geometry.location.lng ?? 0

        location = data.status === 'ZERO_RESULTS' && undefined

        if(location === undefined || location.includes('undefined')) {
            setLoading(false)
            toast.error('Invalid location, please input correct address')
        } else {
            geolocation.lat = latitude
            geolocation.lng = longitude
        }
    }
    async function storeImage(image) {
        return new Promise((resolve, reject)=>{
            const storage = getStorage()
            const filename = `${auth.currentUser.uid}-${image.name}-${uuidv4()}`
            const storageRef = ref(storage, filename)
            const uploadTask = uploadBytesResumable(storageRef, image)
            uploadTask.on('state_changed', 
                (snapshot) => {
                    // Observe state change events such as progress, pause, and resume
                    // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload is ' + progress + '% done');
                    switch (snapshot.state) {
                    case 'paused':
                        console.log('Upload is paused');
                        break;
                    case 'running':
                        console.log('Upload is running');
                        break;
                    }
                }, 
                (error) => {
                    // Handle unsuccessful uploads
                    reject(error)
                }, 
                () => {
                    // Handle successful uploads on complete
                    // For instance, get the download URL: https://firebasestorage.googleapis.com/...
                    getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    resolve(downloadURL);
                    });
                }
                )
        })
    }
    const imgUrls = await Promise.all(
        [...images].map((image)=>storeImage(image)))
        .catch((error)=>{
        setLoading(false)
        toast.error('Images not uploaded')
        return
    })

    const formDataCopy = {
        ...formData,
        imgUrls,
        geolocation,
        timestamp: serverTimestamp(),
        userRef: auth.currentUser.uid
    }
    delete formDataCopy.images;
    !formDataCopy.offer && delete formDataCopy.discountedPrice
    delete formDataCopy.latitude
    delete formDataCopy.longitude
    const docRef = await addDoc(collection(db, "listings"), formDataCopy)
    setLoading(false)
    toast.success('Listing posted')
    navigate(`/category/${formDataCopy.type}/${docRef.id}`)
  } 

  if (loading) { 
    return <Spinner />
  }

  return (
    <main className='max-w-md px-2 mx-auto'>
        <h1 className='text-3xl text-center mt-6 font-bold'>Create a Listing</h1>
        <form onSubmit={onSubmit}>
            <p className='text-lg mt-6 font-semibold'>Sell / Rent</p>
            <div className='flex'>
                <button type='button' id='type' value='sale' onClick={onChange} className={`mr-3 px-7 py-3 font-medium text-sm uppercase shadow-md rounded hover:shadow-lg focus:shadow-lg active:shadow-lg transition duration-150 ease-in-out w-full ${type === 'sale' ? 'bg-slate-600 text-white': 'bg-white text-black'}`}>
                    SELL
                </button>
                <button type='button' id='type' value='rent' onClick={onChange} className={`ml-3 px-7 py-3 font-medium text-sm uppercase shadow-md rounded hover:shadow-lg focus:shadow-lg active:shadow-lg transition duration-150 ease-in-out w-full ${type === 'rent' ? 'bg-slate-600 text-white': 'bg-white text-black'}`}>
                    RENT
                </button>
            </div>
            <p className='text-lg mt-6 font-semibold'>Name</p>
            <input type="text" value={name} id="name" onChange={onChange} placeholder='Property Name' maxLength='32' minLength='10' required className='w-full px-4 py-2 text-xl text-gray-700 bg-white border border-gray-300 rounded transition duration-150 ease-in-out focus:text-gray-700 focus:bg-white focus:border-slate-600 mb-6'/>
            <div className='flex space-x-6 justify-start mb-6'>
                <div>
                    <p className='text-lg font-semibold'>Beds</p>
                    <input type="number" id="bedrooms" value={bedrooms} onChange={onChange} min='1' max='50' required className='w-full px-4 py-2 text-xl text-gray-700 bg-white border border-gray-300 rounded transition duration-150 ease-in-out text-center focus:text-gray-700 focus:bg-white focus:border-slate-600'/>
                </div>
                <div>
                    <p className='text-lg font-semibold'>Baths</p>
                    <input type="number" id="bathrooms" value={bathrooms} onChange={onChange} min='1' max='50' required className='w-full px-4 py-2 text-xl text-gray-700 bg-white border border-gray-300 rounded transition duration-150 ease-in-out text-center focus:text-gray-700 focus:bg-white focus:border-slate-600'/>
                </div>
            </div>
            <p className='text-lg mt-6 font-semibold'>Parking spot</p>
            <div className='flex'>
                <button type='button' id='parking' value={true} onClick={onChange} className={`mr-3 px-7 py-3 font-medium text-sm uppercase shadow-md rounded hover:shadow-lg focus:shadow-lg active:shadow-lg transition duration-150 ease-in-out w-full ${!parking ? 'bg-white text-black' : 'bg-slate-600 text-white'}`}>
                    Yes
                </button>
                <button type='button' id='parking' value={false} onClick={onChange} className={`ml-3 px-7 py-3 font-medium text-sm uppercase shadow-md rounded hover:shadow-lg focus:shadow-lg active:shadow-lg transition duration-150 ease-in-out w-full ${parking ? 'bg-white text-black' : 'bg-slate-600 text-white'}`}>
                    No
                </button>
            </div>
            <p className='text-lg mt-6 font-semibold'>Furnished</p>
            <div className='flex'>
                <button type='button' id='furnished' value={true} onClick={onChange} className={`mr-3 px-7 py-3 font-medium text-sm uppercase shadow-md rounded hover:shadow-lg focus:shadow-lg active:shadow-lg transition duration-150 ease-in-out w-full ${!furnished ? 'bg-white text-black' : 'bg-slate-600 text-white'}`}>
                    Yes
                </button>
                <button type='button' id='furnished' value={false} onClick={onChange} className={`ml-3 px-7 py-3 font-medium text-sm uppercase shadow-md rounded hover:shadow-lg focus:shadow-lg active:shadow-lg transition duration-150 ease-in-out w-full ${furnished? 'bg-white text-black' : 'bg-slate-600 text-white'}`}>
                    No
                </button>
            </div>
            <p className='text-lg mt-6 font-semibold'>Address</p>
            <textarea type="text" value={address} id="address" onChange={onChange} placeholder='Address' required className='resize-none w-full px-4 py-2 text-xl text-gray-700 bg-white border border-gray-300 rounded transition duration-150 ease-in-out focus:text-gray-700 focus:bg-white focus:border-slate-600'/>
            {!geolocationEnabled && (
                <div className='flex space-x-6 justify-start mt-2'>
                    <div>
                        <p className='text-xl font-semibold'>Latitude</p>
                        <input type="number" value={latitude} id="latitude" onChange={onChange} required className='w-full px-4 py-2 text-xl text-gray-700 bg-white border border-gray-300 rounded transition duration-150 ease-in-out focus:bg-white focus:text-gray-700 focus:border-slate-600 text-center' min='-90' max='90'/>
                    </div>
                    <div>
                        <p className='text-xl font-semibold'>Longitude</p>
                        <input type="number" value={longitude} id="longitude" onChange={onChange} required className='w-full px-4 py-2 text-xl text-gray-700 bg-white border border-gray-300 rounded transition duration-150 ease-in-out focus:bg-white focus:text-gray-700 focus:border-slate-600 text-center'min='-180' max='180'/>
                    </div>
                </div>
            )}
            <p className='text-lg font-semibold mt-6'>Description</p>
            <textarea type="text" value={description} id="description" onChange={onChange} placeholder='Description' required className='resize-none w-full px-4 py-2 text-xl text-gray-700 bg-white border border-gray-300 rounded transition duration-150 ease-in-out focus:text-gray-700 focus:bg-white focus:border-slate-600 mb-6'/>
            <p className='text-lg font-semibold'>Offer</p>
            <div className='flex items-center justify-center'>
                <button type='button' id='offer' value={true} onClick={onChange} className={`px-7 py-3 font-medium text-sm uppercase shadow-md rounded hover:shadow-lg focus:shadow-lg active:shadow-lg transition duration-150 ease-in-out w-full ${!offer ? 'bg-white text-black' : 'bg-slate-600 text-white'}`}>
                    Yes
                </button>
                <button type='button' id='offer' value={false} onClick={onChange} className={`ml-3 px-7 py-3 font-medium text-sm uppercase shadow-md rounded hover:shadow-lg focus:shadow-lg active:shadow-lg transition duration-150 ease-in-out w-full ${offer ? 'bg-white text-black' : 'bg-slate-600 text-white'}`}>
                    No
                </button>
            </div>
            <div className='flex items-center mt-6 mb-6'>
                <div>
                    <p className='text-lg font-semibold'>Regular price</p>
                    <div className='flex w-full justify-center space-x-6'>
                        <input type="number" id="regularPrice" value={regularPrice} onChange={onChange} min='50' max='400000000' required className='w-full px-4 py-2 text-xl text-gray-700 bg-white border border-gray-300 rounded transition duration-150 ease-in-out focus:text-gray-700 focus:bg-white focus:border-slate-600 text-center'/>
                        {type === 'rent' && (
                            <div> 
                                <p className='text-md w-full'>$ / Month</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {offer && (
                <div>
                    <p className='text-lg font-semibold'>Discounted price</p>
                    <div className='flex w-full justify-center space-x-6'>
                        <input type="number" id="discountedPrice" value={discountedPrice} onChange={onChange} min='50' max='400000000' required={offer} className='w-full px-4 py-2 text-xl text-gray-700 bg-white border border-gray-300 rounded transition duration-150 ease-in-out focus:text-gray-700 focus:bg-white focus:border-slate-600 text-center'/>
                        {type === 'rent' && (
                            <div> 
                                <p className='text-md w-full'>$ / Month</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="mb-6">
                <p className='text-lg font-semibold '>Images</p>
                <p className='text-gray-600'>The first image will be the cover (max 6)</p>
                <input type="file" id="images" multiple onChange={onChange} accept=".jpg, .png, .jpeg" className='w-full px-3 py-1.5 text-gray-700 bg-white border border-gray-300 rounded transition duration-150 ease-in-out focus:bg-white focus:border-slate-600'/>
            </div>
            <button type="submit" className='mb-6 w-full px-7 py-3 bg-blue-600 text-white font-medium text-sm uppercase rounded shadow-md hover:bg-blue-700 hover:shadow-lg focus:bg-blue-700 focus:shadow-lg active:bg-blue-800 active:shadow-lg transition duration-150 ease-in-out'>Create listing</button>
        </form>
    </main>
  )
}